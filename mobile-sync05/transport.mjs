// SYNC-05: standalone mobile transport prototype. NOT imported by UI-145.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO=/^00000000-0000-4000-8000-000000000(?:001|10[1-4])$/i;
export const isOperationalId=x=>typeof x==='string'&&UUID.test(x)&&!DEMO.test(x);
export class Sync05Error extends Error {
  constructor(code,kind='retry'){super(code);this.name='Sync05Error';this.code=code;this.kind=kind;}
}
function requireId(x){
  if(!isOperationalId(x))throw new Sync05Error('UNMAPPED_OR_DEMO_ID','review');
  return x.toLowerCase();
}
export function canonicalPointage(e){
  if(!e||!['board','alight'].includes(e.type))throw new Sync05Error('NOT_A_POINTAGE','review');
  if(typeof e.occurredAt!=='string'||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(e.occurredAt)||
     !Number.isFinite(Date.parse(e.occurredAt)))
    throw new Sync05Error('INVALID_LOCAL_TIME','review');
  return {id:requireId(e.id),tripId:requireId(e.tripId),
    studentId:requireId(e.studentId),stopId:e.stopId==null?null:requireId(e.stopId),
    type:e.type,occurredAt:e.occurredAt};
}
export function createSync05Transport({baseUrl,getAccessToken,fetchImpl=globalThis.fetch}={}){
  if(typeof baseUrl!=='string'||typeof getAccessToken!=='function'||
     typeof fetchImpl!=='function')throw new TypeError('SYNC05_CONFIG_REQUIRED');
  let origin;
  try{
    const u=new URL(baseUrl);
    if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||
       u.pathname!=='/'||!u.hostname)throw Error();
    origin=u.origin;
  }catch{throw new TypeError('SYNC05_HTTPS_ORIGIN_REQUIRED');}
  async function request(method,path,payload){
    const token=await getAccessToken();
    if(typeof token!=='string'||!token||token.length>8192||/\s/.test(token))
      throw new Sync05Error('AUTH_REQUIRED');
    let r;
    try{
      r=await fetchImpl(origin+path,{method,cache:'no-store',redirect:'error',
        credentials:'omit',
        headers:{authorization:'Bearer '+token,...(payload?{'content-type':'application/json'}:{})},
        ...(payload?{body:JSON.stringify(payload)}:{})});
    }catch{throw new Sync05Error('NETWORK_UNAVAILABLE');}
    let body=null;try{body=await r.json();}catch{}
    if(r.status===401)throw new Sync05Error('AUTH_REQUIRED');
    if(r.status===403)throw new Sync05Error('NOT_AUTHORIZED','permanent');
    if(r.status===409)throw new Sync05Error('NEEDS_MANUAL_REVIEW','review');
    if(r.status===404)throw new Sync05Error('NOT_FOUND','permanent');
    if(r.status===422)throw new Sync05Error('SERVER_REJECTED_EVENT','review');
    if(r.status===429||r.status>=500)throw new Sync05Error('SERVER_UNAVAILABLE');
    return {status:r.status,body};
  }
  async function sendPointage(e){
    const event=canonicalPointage(e);
    const {status,body}=await request('POST','/api/v3/sync/events',event);
    if(!((status===201&&body?.result==='recorded')||
         (status===200&&body?.result==='already_recorded'))||
       body?.eventId!==event.id||
       !Number.isSafeInteger(body?.sequenceNo)||body.sequenceNo<1)
      throw new Sync05Error('INVALID_SERVER_ACK');
    return {result:body.result,sequenceNo:body.sequenceNo};
  }
  async function getSnapshot(tripId){
    const id=requireId(tripId);
    const {status,body}=await request('GET','/api/v3/sync/trips/'+id+'/snapshot');
    if(status!==200||body?.trip?.id!==id||
       !['parent','driver','attendant','admin'].includes(body.scope)||
       !Array.isArray(body.students)||!Array.isArray(body.events))
      throw new Sync05Error('INVALID_SERVER_SNAPSHOT');
    // Server MUST filter children; this client validation is not authorization.
    return body;
  }
  return Object.freeze({sendPointage,getSnapshot});
}
