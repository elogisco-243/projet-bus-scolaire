'use strict';

// SYNC-04: isolated authenticated POST; no server route registration by default.
const {parseOfflineStudentEvent}=require('./sync02-events');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&UUID.test(x);
function json(res,status,obj) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'});
  res.end(JSON.stringify(obj));
}
async function bodyJson(req) {
  let bytes=0;const chunks=[];
  for await(const chunk of req) {
    bytes+=chunk.length;
    if(bytes>4096) {const err=Error('BODY_TOO_LARGE');err.status=413;throw err;}
    chunks.push(chunk);
  }
  try {const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();
    return parsed;
  }catch{const err=Error('INVALID_JSON');err.status=400;throw err;}
}
function createSync04WriteApi({verifyToken,loadActor,saveEvent}) {
  if(![verifyToken,loadActor,saveEvent].every(f=>typeof f==='function'))
    throw TypeError('Verified identity, actor reader, and secure writer required');
  return async function handler(req,res) {
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname!=='/api/v3/sync/events')return json(res,404,{error:'NOT_FOUND'});
      if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
      if(url.search)return json(res,400,{error:'UNEXPECTED_QUERY'});
      if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))
        return json(res,415,{error:'JSON_REQUIRED'});
      const authorization=req.headers.authorization;
      if(typeof authorization!=='string'||authorization.length>8200||
         !/^[Bb]earer [A-Za-z0-9_.-]+$/.test(authorization))
        return json(res,401,{error:'UNAUTHORIZED'});
      let identity;
      try {identity=await verifyToken(authorization.slice(7));}
      catch{return json(res,401,{error:'UNAUTHORIZED'});}
      if(typeof identity?.subject!=='string'||!identity.subject||
         !uuid(identity.actorId))return json(res,401,{error:'UNAUTHORIZED'});
      const actor=await loadActor(identity.subject,identity);
      if(!actor||actor.userId!==identity.actorId||typeof actor.identitySubject!=='string'||
         actor.identitySubject!==identity.subject)
        return json(res,401,{error:'UNAUTHORIZED'});
      const raw=await bodyJson(req);
      const parsed=parseOfflineStudentEvent(raw);
      if(!parsed.ok)return json(res,422,{error:parsed.reason});
      const receipt=await saveEvent(actor,parsed.event);
      return json(res,receipt.result==='recorded'?201:200,{
        eventId:parsed.event.id,result:receipt.result,sequenceNo:receipt.sequenceNo
      });
    }catch(e) {
      if(e.status)return json(res,e.status,{error:e.message});
      // Never expose SQL details or allow a client to infer a third party's data.
      if(e.code==='42501'||e.code==='28000')
        return json(res,403,{error:'NOT_AUTHORIZED'});
      if(e.code==='23505'||e.code==='23514')
        return json(res,409,{error:'EVENT_CONFLICT_OR_NOT_READY'});
      return json(res,503,{error:'WRITE_UNAVAILABLE'});
    }
  };
}
module.exports={createSync04WriteApi};
