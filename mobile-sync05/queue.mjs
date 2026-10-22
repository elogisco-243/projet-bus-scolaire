// SYNC-05: bridge for existing offline-queue.mjs event shape.
// App UI-145 does NOT import this. Atomic durable persistence is external.
import {Sync05Error} from './transport.mjs';
export function createSync05QueueRunner({load,persist,transport,enabled=false}={}){
  if(typeof load!=='function'||typeof persist!=='function'||
     typeof transport?.sendPointage!=='function')
    throw new TypeError('SYNC05_QUEUE_DEPENDENCIES_REQUIRED');
  let running=false;
  return Object.freeze({async run(){
    if(!enabled)throw new Sync05Error('SYNC05_DISABLED');
    if(running)throw new Sync05Error('SYNC05_ALREADY_RUNNING');
    running=true;
    try{
      let current=await load();
      if(!Array.isArray(current))throw new TypeError('SYNC05_QUEUE_CORRUPT');
      const stats={confirmed:0,rejected:0,skipped:0,halted:null};
      for(const item of [...current]){
        if(item?.status!=='pending')continue;
        if(!['board','alight'].includes(item.type)){stats.skipped++;continue;}
        current=current.map(e=>e.id===item.id&&e.status==='pending'?
          {...e,attempts:(Number.isInteger(e.attempts)?e.attempts:0)+1}:e);
        await persist(current);
        try{
          const ack=await transport.sendPointage(item);
          if(!['recorded','already_recorded'].includes(ack?.result)||
             !Number.isSafeInteger(ack?.sequenceNo)||ack.sequenceNo<1)
            throw new Sync05Error('INVALID_SERVER_ACK');
          current=current.map(e=>e.id===item.id&&e.status==='pending'?
            {...e,status:'synced',serverResult:ack.result,serverSequenceNo:ack.sequenceNo}:e);
          await persist(current);
          stats.confirmed++;
        }catch(err){
          if(err?.kind==='permanent'){
            current=current.map(e=>e.id===item.id&&e.status==='pending'?
              {...e,status:'rejected',reason:err.code||'SERVER_REJECTED_EVENT'}:e);
            await persist(current);stats.rejected++;
            continue;
          }
          stats.halted=err?.code||'NETWORK_UNAVAILABLE';
          break;
        }
      }
      return {queue:current,stats};
    }finally{running=false;}
  }});
}
