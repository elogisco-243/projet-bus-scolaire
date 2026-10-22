// A2S Scola SYNC-06: staging-only assignment guard.
// It is a CLIENT SAFETY GATE, not a replacement for server authorization.
// Never accept bindings from localStorage, UI role controls or QR labels.
import {canonicalPointage,isOperationalId,Sync05Error} from '../mobile-sync05/transport.mjs';
const ROLES=new Set(['attendant','driver']);
const MAX_IDS=500;
const MAX_AGE_MS=10*60*1000;
const validId=id=>isOperationalId(id);
const fail=code=>{throw new Sync05Error(code,'review');};
function ids(list){
  if(!Array.isArray(list)||list.length>MAX_IDS)return null;
  const out=new Set();
  for(const id of list){
    if(!validId(id))return null;
    out.add(id.toLowerCase());
  }
  return out;
}
export function validateServerAssignment(value,context,now=Date.now()){
  if(!value||typeof value!=='object'||!context||
     value.source!=='authenticated_v3'||value.active!==true||
     !ROLES.has(value.role)||value.permission!=='pointage:write')fail('ASSIGNMENT_UNVERIFIED');
  const required=['actorId','schoolId','operatorId','tripId'];
  for(const k of required){
    if(!validId(value[k])||!validId(context[k])||
       value[k].toLowerCase()!==context[k].toLowerCase())
      fail('ASSIGNMENT_CONTEXT_MISMATCH');
  }
  if(!Number.isFinite(now)||!Number.isFinite(value.issuedAt)||
     !Number.isFinite(value.expiresAt)||value.issuedAt>now+30000||
     value.expiresAt<=now||value.expiresAt-value.issuedAt>MAX_AGE_MS)
    fail('ASSIGNMENT_EXPIRED');
  const students=ids(value.studentIds),stops=ids(value.stopIds);
  if(!students||!stops||students.size===0||stops.size===0)
    fail('ASSIGNMENT_INVALID_REFERENCES');
  return Object.freeze({actorId:value.actorId.toLowerCase(),
    schoolId:value.schoolId.toLowerCase(),operatorId:value.operatorId.toLowerCase(),
    tripId:value.tripId.toLowerCase(),role:value.role,studentIds:students,stopIds:stops});
}
export function createSync06AuthorizedTransport({transport,context,loadVerifiedAssignment,now=Date.now}={}){
  if(!transport||typeof transport.sendPointage!=='function'||
     typeof loadVerifiedAssignment!=='function'||typeof now!=='function')
    throw new TypeError('SYNC06_TRUSTED_ASSIGNMENT_REQUIRED');
  return Object.freeze({
    async sendPointage(raw){
      const event=canonicalPointage(raw);
      // Refetch on EVERY event; revocation/rotation must block queued writes.
      const fresh=validateServerAssignment(await loadVerifiedAssignment(),context,now());
      if(event.tripId!==fresh.tripId||!fresh.studentIds.has(event.studentId)||
         !event.stopId||!fresh.stopIds.has(event.stopId))
        fail('ASSIGNMENT_EVENT_NOT_ALLOWED');
      return transport.sendPointage(event);
    }
  });
}
