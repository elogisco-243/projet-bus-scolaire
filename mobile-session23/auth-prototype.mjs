import {randomBytes,createHash} from 'node:crypto';
import {authorizeOperationalAction} from '../mobile-session22/operational-policy.mjs';
const denied=code=>({ok:false,code});
const digest=t=>createHash('sha256').update(t).digest('hex');
/** UI-173 isolated test prototype. Upstream proof is SIMULATED, not real authentication. */
export function createAuthPrototype({clock=()=>Date.now(),ttlMs=900000}={}){
 if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>86400000)throw Error('INVALID_TTL');
 const sessions=new Map(),events=[];
 const audit=(type,code)=>events.push(Object.freeze({seq:events.length+1,time:clock(),type,code}));
 function issue({principal,upstreamProof}={}){
  if(upstreamProof?.testOnly!==true||upstreamProof?.verifiedByTrustedGateway!==true){
   audit('issue_denied','UPSTREAM_REQUIRED');return denied('UPSTREAM_REQUIRED');
  }
  if(!principal||principal.source!=='trusted_gateway'||principal.active!==true||
   !['driver','attendant','parent','supervisor'].includes(principal.role)||
   typeof principal.id!=='string'||!principal.id||
   typeof principal.organizationId!=='string'||!principal.organizationId){
   audit('issue_denied','INVALID_PRINCIPAL');return denied('INVALID_PRINCIPAL');
  }
  const token=randomBytes(32).toString('hex'),expiresAt=clock()+ttlMs;
  sessions.set(digest(token),{principal:structuredClone(principal),expiresAt,revoked:false});
  audit('issued','OK');return {ok:true,token,expiresAt};
 }
 function authenticate(token){
  if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))return denied('INVALID_SESSION');
  const s=sessions.get(digest(token));
  if(!s)return denied('INVALID_SESSION');
  if(s.revoked)return denied('REVOKED_SESSION');
  if(clock()>=s.expiresAt)return denied('EXPIRED_SESSION');
  return {ok:true,principal:structuredClone(s.principal)};
 }
 function revoke(token){
  const s=typeof token==='string'?sessions.get(digest(token)):null;
  if(!s)return denied('INVALID_SESSION');
  s.revoked=true;audit('revoked','OK');return {ok:true};
 }
 function authorize(token,action,resource){
  const session=authenticate(token);
  if(!session.ok){audit('denied',session.code);return session;}
  const decision=authorizeOperationalAction({principal:session.principal,action,resource,
    verifiedContext:{serverVerified:true,authenticationStrength:'verified'}});
  audit(decision.ok?'allowed':'denied',decision.code);return decision;
 }
 return Object.freeze({issue,authenticate,revoke,authorize,audit:()=>events.map(e=>({...e}))});
}
