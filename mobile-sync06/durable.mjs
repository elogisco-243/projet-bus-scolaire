// A2S Scola SYNC-06: strict native storage CONTRACT (no Android plugin supplied).
// Bridge must enforce an OS-wide lease and atomic encrypted SQLite CAS.
// JS cannot prove encryption or lease semantics; real native implementation and
// security review are mandatory before any mobile connection.
import {Sync05Error,isOperationalId} from '../mobile-sync05/transport.mjs';
import {createSync05QueueRunner} from '../mobile-sync05/queue.mjs';
import {createSync06AuthorizedTransport} from './assignment.mjs';
const statuses=new Set(['pending','synced','rejected']);
const allowed=new Set(['board','alight','stop_arrival','traffic','breakdown','accident','delay','emergency']);
function ensureReady(bridge,state){
  if(!state||state.version!==1||state.provider!=='native_encrypted_sqlite'||
     state.atomicRevision!==true||state.deviceWideLease!==true||
     state.locked!==false)throw new Sync05Error('SECURE_NATIVE_STORAGE_REQUIRED','review');
}
function validateQueue(items){
  if(!Array.isArray(items)||items.length>10000)throw new Sync05Error('QUEUE_INVALID','review');
  const seen=new Set();
  for(const x of items){
    if(!x||typeof x!=='object'||Array.isArray(x)||!statuses.has(x.status)||
       typeof x.id!=='string'||seen.has(x.id)||
       typeof x.type!=='string'||!allowed.has(x.type)||
       !Number.isInteger(x.attempts)||x.attempts<0)
      throw new Sync05Error('QUEUE_INVALID','review');
    seen.add(x.id);
  }
  return items;
}
function checkTransition(before,after){
  validateQueue(after);
  if(after.length!==before.length)throw new Sync05Error('QUEUE_MUTATION_FORBIDDEN','review');
  const previous=new Map(before.map(x=>[x.id,x]));
  for(const x of after){
    const prior=previous.get(x.id);
    if(!prior||x.attempts<prior.attempts||
       prior.status!=='pending'&&prior.status!==x.status)
      throw new Sync05Error('QUEUE_MUTATION_FORBIDDEN','review');
    for(const k of ['id','type','tripId','studentId','stopId','occurredAt']){
      if(x[k]!==prior[k])throw new Sync05Error('QUEUE_MUTATION_FORBIDDEN','review');
    }
    if(prior.status==='pending'&&x.status==='synced'&&
       !['recorded','already_recorded'].includes(x.serverResult))
      throw new Sync05Error('QUEUE_MUTATION_FORBIDDEN','review');
  }
}
function partition(context){
  if(context?.mode!=='staging'||!['actorId','schoolId','operatorId','tripId']
     .every(k=>isOperationalId(context[k])))
    throw new Sync05Error('STAGING_CONTEXT_REQUIRED','review');
  return 'a2s-scola-sync06:'+['actorId','schoolId','operatorId','tripId']
    .map(k=>context[k].toLowerCase()).join(':');
}
export function createSync06DurableRunner({bridge,transport,context,loadVerifiedAssignment,enabled=false,now=Date.now}={}){
  const p=partition(context);
  if(!bridge||!['inspect','withExclusiveLease','read','compareAndSwap']
      .every(k=>typeof bridge[k]==='function'))
    throw new TypeError('SYNC06_NATIVE_BRIDGE_REQUIRED');
  const guarded=createSync06AuthorizedTransport({transport,context,loadVerifiedAssignment,now});
  return Object.freeze({
    async run(){
      if(!enabled)throw new Sync05Error('SYNC06_DISABLED');
      ensureReady(bridge,await bridge.inspect());
      return bridge.withExclusiveLease(p,async()=>{
        ensureReady(bridge,await bridge.inspect());
        let revision=0,last=[];
        const load=async()=>{
          const state=await bridge.read(p);
          if(!state||!Number.isSafeInteger(state.revision)||state.revision<0)
            throw new Sync05Error('QUEUE_REVISION_INVALID','review');
          revision=state.revision;
          last=structuredClone(validateQueue(state.items));
          return structuredClone(last);
        };
        const persist=async next=>{
          checkTransition(last,next);
          const committed=await bridge.compareAndSwap(p,revision,structuredClone(next));
          if(!committed||committed.revision!==revision+1)
            throw new Sync05Error('QUEUE_CAS_CONFLICT','retry');
          revision=committed.revision;
          last=structuredClone(next);
        };
        const runner=createSync05QueueRunner({
          load,persist,transport:guarded,enabled:true
        });
        return runner.run();
      });
    }
  });
}
