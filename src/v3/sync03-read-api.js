'use strict';

// A2S Scola V3 SYNC-03: isolated read-only HTTP contract (NOT mounted in staging).
// Both callbacks must read trusted server-side identity and DB records, protected
// by a short-lived verified JWT and RLS-enabled read-only PostgreSQL transactions.
// The mobile never supplies roles, parent links, actor IDs or tenancy decisions.
const { canViewTrip, hasMembership } = require('./authorization');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_ALLOWLIST=new Set(['school_admin','operator_admin','dispatcher','driver','attendant','parent']);
const STATUS=new Set(['assigned','aboard','alighted']);
const ACTIONS=new Set(['board','alight']);
const TRIP_STATUS=new Set(['planned','in_progress','completed','cancelled']);
const id=x=>typeof x==='string'&&UUID.test(x);
const array=x=>Array.isArray(x)?x:[];
function respond(res,status,body) {
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  });
  res.end(JSON.stringify(body));
}
function authorizedScope(actor,ctx) {
  const trip=ctx?.trip;
  if(!id(actor?.userId)||!trip||!id(trip.id)||!id(trip.schoolId)||!id(trip.operatorId)) return null;
  if(!Array.isArray(ctx.tripStudentIds)) return null;
  const assigned=new Set(ctx.tripStudentIds.filter(id));
  if(hasMembership(actor,'school_admin',trip.schoolId) ||
     hasMembership(actor,'operator_admin',trip.operatorId) ||
     hasMembership(actor,'dispatcher',trip.operatorId)) return {role:'admin',assigned};
  if(actor.userId===trip.driverUserId&&hasMembership(actor,'driver',trip.operatorId))
    return {role:'driver',assigned};
  if(hasMembership(actor,'attendant',trip.operatorId)&&
     array(ctx.attendantAssignments).some(a=>a&&a.userId===actor.userId&&
       a.tripId===trip.id&&a.active===true&&a.revokedAt==null))
    return {role:'attendant',assigned};
  if(canViewTrip(actor,ctx)&&hasMembership(actor,'parent',trip.schoolId)){
    const linked=new Set(array(actor.verifiedStudentIds).filter(id));
    const own=[...assigned].filter(s=>linked.has(s));
    return own.length?{role:'parent',assigned:new Set(own)}:null;
  }
  return null;
}
function projectAuthorizedTrip(actor,ctx) {
  const scope=authorizedScope(actor,ctx);
  if(!scope) return null;
  const trip=ctx.trip;
  const statuses=new Map(array(ctx.studentStatuses).filter(s=>
    s&&id(s.studentId)&&scope.assigned.has(s.studentId)).map(s=>
      [s.studentId,STATUS.has(s.status)?s.status:'assigned']));
  const students=[...scope.assigned].map(studentId=>({
    studentId,status:statuses.get(studentId)||'assigned'
  }));
  const events=array(ctx.studentEvents).filter(e=>e&&id(e.studentId)&&
    scope.assigned.has(e.studentId)&&id(e.eventId)&&ACTIONS.has(e.action))
    .slice(0,500).map(e=>({
      eventId:e.eventId,studentId:e.studentId,action:e.action,
      occurredAt:typeof e.occurredAt==='string'?e.occurredAt.slice(0,35):null
    }));
  const result={
    trip:{
      id:trip.id,status:TRIP_STATUS.has(trip.status)?trip.status:'planned',
      routeCode:typeof trip.routeCode==='string'?trip.routeCode.slice(0,64):null
    },
    scope:scope.role,students,events
  };
  // Parent must never see the full manifest, crew, other students or stops.
  if(scope.role!=='parent'){
    result.routeStops=array(ctx.routeStops).filter(s=>s&&id(s.id)&&
      Number.isSafeInteger(s.sequence)&&s.sequence>0).slice(0,200)
      .map(s=>({id:s.id,sequence:s.sequence,
        label:typeof s.label==='string'?s.label.slice(0,160):'',
        reached:s.reached===true})).sort((a,b)=>a.sequence-b.sequence);
  }
  return result;
}
function createSync03ReadApi({verifyToken,loadActor,loadTripSnapshot}) {
  if(typeof verifyToken!=='function'||typeof loadActor!=='function'||
     typeof loadTripSnapshot!=='function')
    throw new TypeError('SYNC-03 requires verified identity and trusted scoped DB readers');
  return async function sync03ReadApi(req,res) {
    try {
      const url=new URL(req.url,'http://localhost');
      const path=url.pathname;
      if(path!=='/api/v3/sync/me' &&
         !/^\/api\/v3\/sync\/trips\/[^/]+\/snapshot$/.test(path))
        return respond(res,404,{error:'NOT_FOUND'});
      if(req.method!=='GET') return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
      if(url.search!=='') return respond(res,400,{error:'UNEXPECTED_QUERY'});
      const h=req.headers.authorization;
      if(typeof h!=='string'||h.length>8200||!/^[Bb]earer [A-Za-z0-9_.-]+$/.test(h))
        return respond(res,401,{error:'UNAUTHORIZED'});
      let verified;
      try {verified=await verifyToken(h.slice(7));}
      catch{return respond(res,401,{error:'UNAUTHORIZED'});}
      if(!verified||typeof verified.subject!=='string'||!verified.subject||
         verified.subject.length>255)
        return respond(res,401,{error:'UNAUTHORIZED'});
      const actor=await loadActor(verified.subject);
      if(!id(actor?.userId)||!Array.isArray(actor.memberships))
        return respond(res,401,{error:'UNAUTHORIZED'});
      if(path==='/api/v3/sync/me'){
        const memberships=actor.memberships.filter(m=>m&&m.active===true&&
          id(m.organizationId)&&ROLE_ALLOWLIST.has(m.role))
          .map(m=>({organizationId:m.organizationId,role:m.role}));
        return respond(res,200,{userId:actor.userId,memberships});
      }
      const match=/^\/api\/v3\/sync\/trips\/([^/]+)\/snapshot$/.exec(path);
      if(!match||!id(match[1])) return respond(res,400,{error:'INVALID_TRIP_ID'});
      const ctx=await loadTripSnapshot(actor,match[1].toLowerCase());
      // For inaccessible and missing trips return the same status.
      const snapshot=projectAuthorizedTrip(actor,ctx);
      if(!snapshot||snapshot.trip.id.toLowerCase()!==match[1].toLowerCase())
        return respond(res,404,{error:'NOT_FOUND'});
      return respond(res,200,snapshot);
    } catch {
      // Never echo JWTs, SQL errors, account data or connection details.
      return respond(res,500,{error:'INTERNAL_ERROR'});
    }
  };
}
module.exports={createSync03ReadApi,projectAuthorizedTrip,authorizedScope};
