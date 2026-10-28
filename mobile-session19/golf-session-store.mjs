/** UI-187: pure demo-only session store protocol. Neither real auth nor cross-device sync.
 * Callers supply their own persistence adapter (in-memory in tests; browser storage later).
 * Optimistic revisions prevent a stale tab from silently overwriting newer data.
 */
import {createGolfDemoSnapshot,validateGolfSnapshot,projectGolfDemo} from './golf-route-adapter.mjs';
const fail=code=>Object.freeze({ok:false,code});
const clone=x=>structuredClone(x);
export function createGolfSessionStore(storage,{key='A2S_SCOLA_UI187_GOLF_DEMO_V1'}={}){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
  throw Error('STORAGE_ADAPTER_REQUIRED');
 const load=()=>{
  const raw=storage.getItem(key);
  if(raw===null)return {ok:true,snapshot:createGolfDemoSnapshot(),newSession:true};
  let s;
  try{s=JSON.parse(raw);}catch{return fail('CORRUPT_SNAPSHOT');}
  const valid=validateGolfSnapshot(s);
  return valid.ok?{ok:true,snapshot:clone(s),newSession:false}:valid;
 };
 const read=role=>{
  const result=load();
  if(!result.ok)return result;
  return projectGolfDemo(result.snapshot,role);
 };
 const initialize=()=>{
  const existing=storage.getItem(key);
  if(existing!==null)return load();
  const snapshot=createGolfDemoSnapshot();
  storage.setItem(key,JSON.stringify(snapshot));
  return {ok:true,snapshot:clone(snapshot),newSession:true};
 };
 const commit=(next,{expectedRevision}={})=>{
  // Safety: store mutations must be dispatched by a separately tested,
  // role-aware DEMO reducer. This layer only handles revisions and integrity.
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return fail('EXPECTED_REVISION_REQUIRED');
  const current=load();
  if(!current.ok)return current;
  if(current.snapshot.revision!==expectedRevision)return fail('STALE_DEMO_REVISION');
  const valid=validateGolfSnapshot(next);
  if(!valid.ok)return valid;
  if(next.revision!==expectedRevision+1)return fail('REVISION_INCREMENT_REQUIRED');
  if(next.routeId!==current.snapshot.routeId||next.busId!==current.snapshot.busId)
   return fail('ROUTE_IMMUTABLE');
  // Browser localStorage is not a transactional compare-and-swap.
  // Never present this check as race-safe across simultaneous writers.
  storage.setItem(key,JSON.stringify(next));
  return {ok:true,snapshot:clone(next),transactional:false};
 };
 return Object.freeze({load,read,initialize,commit});
}
export function createMemoryDemoStorage(){
 const m=new Map();
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v));}};
}
