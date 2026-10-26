import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoHub} from '../mobile-session21/demo-hub.mjs';
let ctr=0;
async function openHub(){
 const server=createDemoHub().listen({port:0});
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 return {base,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function call(h,path,{token=null,body=null,method=null,origin=null}={}){
 const res=await fetch(h.base+path,{method:method||(body===null?'GET':'POST'),
  headers:{...(token?{authorization:'Bearer '+token}:{}),
    ...(body!==null?{'content-type':'application/json'}:{}),...(origin?{origin}:{})},
  ...(body!==null?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 return {status:res.status,data:await res.json()};
}
const join=async(h,profile)=>{
 const r=await call(h,'/api/join',{body:{profile}});
 assert.equal(r.status,200);
 return r.data.token;
};
const state=async(h,token)=>{
 const r=await call(h,'/api/state',{token});assert.equal(r.status,200);return r.data.snapshot;
};
async function act(h,token,type,payload={},commandId=null,override={}){
 const snap=await state(h,token);
 return call(h,'/api/action',{token,body:{
  type,payload,expectedRevision:snap.revision,commandId:commandId||'COMMAND-'+String(++ctr).padStart(8,'0'),...override
 }});
}
async function ok(h,token,type,payload={}){
 const result=await act(h,token,type,payload);
 assert.equal(result.status,200,JSON.stringify(result.data));
 return result.data.snapshot;
}
const route=async(h,driver,attendant)=>{
 await ok(h,attendant,'ready');
 await ok(h,driver,'start');
 await ok(h,driver,'arrive',{stopId:'STOP-01'});
};
test('UI168/HTTP01: Parent and Supervisor join as separate ephemeral browser sessions; static site and security headers work',async t=>{
 const h=await openHub();t.after(h.close);
 const roles=['chauffeur','accompagnateur','parent','parent2','superviseur'];
 const tokens=await Promise.all(roles.map(p=>join(h,p)));
 assert.equal(new Set(tokens).size,5);
 assert.equal((await call(h,'/api/state')).status,401);
 assert.equal((await call(h,'/api/join',{body:{profile:'admin'}})).status,400);
 const html=await fetch(h.base+'/');assert.equal(html.status,200);
 assert.match(await html.text(),/Choisir une session de test/);
 assert.match(html.headers.get('content-security-policy'),/script-src 'self'/);
 const app=await fetch(h.base+'/app.mjs');assert.equal(app.status,200);
 assert.match(await app.text(),/Demandes Parent/);
 const css=await fetch(h.base+'/style.css');assert.equal(css.status,200);
 assert.match(await css.text(),/role-grid/);
 const attempts=await call(h,'/api/join',{body:{profile:'superviseur'},origin:'https://attacker.invalid'});
 assert.equal(attempts.status,403);
});
test('UI168/HTTP02: same shared trip after attendant preparation and driver start, Parent sees only own children',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur');
 const p=await join(h,'parent'),q=await join(h,'parent2'),s=await join(h,'superviseur');
 assert.equal((await act(h,d,'start')).data.error,'CROSS_ROLE_READY_REQUIRED');
 await route(h,d,a);
 assert.equal((await state(h,s)).stopId,'STOP-01');
 assert.equal((await state(h,p)).status,'in_progress');
 assert.deepEqual((await state(h,p)).children.map(x=>x.studentId),['E-01']);
 assert.deepEqual((await state(h,q)).children.map(x=>x.studentId),['E-02']);
 assert.equal((await act(h,p,'arrive',{stopId:'STOP-02'})).status,403);
 assert.equal((await act(h,p,'review_change_demo',{demoPolicyApproved:true})).status,403);
});
test('UI168/HTTP03: Parent request does not change route before Supervisor explicitly approves and Attendant sees new destination',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),
 p=await join(h,'parent'),s=await join(h,'superviseur');
 await route(h,d,a);
 const request=await ok(h,p,'request_change',{studentId:'E-01',toStopId:'STOP-02',recipientId:'PA-DEMO'});
 assert.equal(request.children[0].dropoffStopId,'STOP-03');
 assert.equal(request.requests[0].status,'pending');
 let sup=await state(h,s);assert.equal(sup.requests[0].status,'pending');
 assert.equal((await state(h,a)).students[0].dropoffStopId,'STOP-03');
 sup=await ok(h,s,'review_change_demo',{requestId:sup.requests[0].id,demoPolicyApproved:true});
 assert.equal(sup.requests[0].status,'approved_demo');
 assert.equal((await state(h,a)).students[0].dropoffStopId,'STOP-02');
 assert.equal((await state(h,p)).requests[0].status,'approved_demo');
});
test('UI168/HTTP04: Supervisor refuses a request and old destination remains unchanged everywhere',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),
 p=await join(h,'parent'),s=await join(h,'superviseur');
 await route(h,d,a);
 const req=await ok(h,p,'request_change',{studentId:'E-01',toStopId:'STOP-02',recipientId:'PA-DEMO'});
 await ok(h,s,'reject_change_demo',{requestId:req.requests[0].id,reason:'policy_refused'});
 assert.equal((await state(h,p)).requests[0].status,'rejected_demo');
 assert.equal((await state(h,a)).students[0].dropoffStopId,'STOP-03');
});
test('UI168/HTTP05: retries, stale updates and forged role are rejected appropriately',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),
 p=await join(h,'parent');
 let s=await state(h,a),id='COMMAND-RETRY-0001';
 let cmd={type:'ready',payload:{},expectedRevision:s.revision,commandId:id};
 assert.equal((await call(h,'/api/action',{token:a,body:cmd})).data.accepted,true);
 assert.equal((await call(h,'/api/action',{token:a,body:cmd})).data.alreadyApplied,true);
 assert.equal((await call(h,'/api/action',{token:a,body:{...cmd,payload:{unexpected:true}}})).data.error,'IDEMPOTENCY_CONFLICT');
 assert.equal((await call(h,'/api/action',{token:d,body:{type:'start',payload:{},
    expectedRevision:s.revision,commandId:'COMMAND-STALE-1'}})).status,409);
 const forged=await call(h,'/api/action',{token:p,body:{
   type:'start',role:'driver',actorId:'DR-DEMO',
   expectedRevision:(await state(h,p)).revision,commandId:'COMMAND-FORGE-1',payload:{}}});
 assert.equal(forged.status,403);
});
test('UI168/HTTP06: critical alerts prevent clearance and fake badge never grants handover',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),s=await join(h,'superviseur');
 await route(h,d,a);
 await ok(h,a,'board',{studentId:'E-01'});
 await ok(h,d,'report_critical',{kind:'missing_child'});
 assert.equal((await act(h,a,'clear_stop')).data.error,'CRITICAL_INCIDENT_OPEN');
 const incident=(await state(h,s)).alerts[0];
 assert.equal((await act(h,a,'resolve_critical_demo',{incidentId:incident.id,demoResolutionConfirmed:true})).status,403);
 await ok(h,s,'resolve_critical_demo',{incidentId:incident.id,demoResolutionConfirmed:true});
 await ok(h,a,'clear_stop');await ok(h,d,'resume');
 await ok(h,d,'arrive',{stopId:'STOP-02'});
 await ok(h,a,'absent',{studentId:'E-02',reason:'family_notified'});
 await ok(h,a,'clear_stop');await ok(h,d,'resume');
 await ok(h,d,'arrive',{stopId:'STOP-03'});
 assert.equal((await act(h,a,'handover_demo',{studentId:'E-01',recipientId:'PA-DEMO',badgeVerified:true})).data.error,'SYNTHETIC_HANDOVER_REVIEW_REQUIRED');
 await ok(h,s,'review_handover_demo',{studentId:'E-01',recipientId:'PA-DEMO',demoRecipientAndPersonChecked:true});
 await ok(h,a,'handover_demo',{studentId:'E-01',recipientId:'PA-DEMO',demoPhysicalHandoverConfirmed:true});
 await ok(h,a,'clear_stop');
 assert.equal((await ok(h,d,'finish',{demoInspectionAcknowledged:true})).status,'completed');
});
test('UI168/HTTP07: local demo reset only via supervisor role and explicit confirmation',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),s=await join(h,'superviseur');
 await ok(h,a,'ready');
 assert.equal((await call(h,'/api/reset',{token:d,body:{confirm:'RESET_DEMO_ONLY'}})).status,403);
 assert.equal((await call(h,'/api/reset',{token:s,body:{confirm:'NOT_APPROVED'}})).status,422);
 assert.equal((await call(h,'/api/reset',{token:s,body:{confirm:'RESET_DEMO_ONLY'}})).status,200);
 assert.equal((await state(h,d)).revision,0);
 assert.equal((await state(h,d)).status,'planned');
});
test('UI168/HTTP08: an intervening pupil action forces an explicit fresh Supervisor review before approval',async t=>{
 const h=await openHub();t.after(h.close);
 const d=await join(h,'chauffeur'),a=await join(h,'accompagnateur'),
 p=await join(h,'parent'),s=await join(h,'superviseur');
 await route(h,d,a);
 const req=await ok(h,p,'request_change',{studentId:'E-01',toStopId:'STOP-02',recipientId:'PA-DEMO'});
 await ok(h,a,'board',{studentId:'E-01'});
 const requestId=req.requests[0].id;
 assert.equal((await act(h,s,'review_change_demo',{requestId,demoPolicyApproved:true})).data.error,'REQUEST_NEEDS_FRESH_REVIEW');
 const reviewed=await ok(h,s,'revalidate_change_demo',{requestId});
 assert.equal(reviewed.requests[0].status,'pending');
 assert.equal(reviewed.requests[0].proposedRevision,reviewed.revision);
 const approved=await ok(h,s,'review_change_demo',{requestId,demoPolicyApproved:true});
 assert.equal(approved.students[0].dropoffStopId,'STOP-02');
});
test('UI168/HTTP09: Parent can predeclare absence for own child before pickup and crew sees it',async t=>{
 const h=await openHub();t.after(h.close);
 const a=await join(h,'accompagnateur'),d=await join(h,'chauffeur'),
 p=await join(h,'parent2'),other=await join(h,'parent');
 assert.equal((await act(h,other,'notify_absence',{studentId:'E-02',reason:'family_notified'})).status,403);
 const updated=await ok(h,p,'notify_absence',{studentId:'E-02',reason:'family_notified'});
 assert.equal(updated.children[0].absent,true);
 assert.equal((await state(h,a)).students.find(x=>x.studentId==='E-02').absent,true);
 await route(h,d,a);
 await ok(h,a,'board',{studentId:'E-01'});
 await ok(h,a,'clear_stop');await ok(h,d,'resume');await ok(h,d,'arrive',{stopId:'STOP-02'});
 assert.equal((await state(h,a)).pendingAtStop,0);
 assert.equal((await act(h,p,'notify_absence',{studentId:'E-02',reason:'family_notified'})).data.error,'ABSENCE_NOT_ALLOWED');
});
test('UI168/HTTP10: Parent can cancel a pending request, leaving destination untouched',async t=>{
 const h=await openHub();t.after(h.close);
 const a=await join(h,'accompagnateur'),d=await join(h,'chauffeur'),
 p=await join(h,'parent'),other=await join(h,'parent2'),su=await join(h,'superviseur');
 await route(h,d,a);
 const request=await ok(h,p,'request_change',{studentId:'E-01',toStopId:'STOP-02',recipientId:'PA-DEMO'});
 const id=request.requests[0].id;
 assert.equal((await act(h,other,'cancel_change',{requestId:id})).status,403);
 const cancelled=await ok(h,p,'cancel_change',{requestId:id});
 assert.equal(cancelled.requests[0].status,'cancelled');
 assert.equal((await state(h,su)).requests[0].status,'cancelled');
 assert.equal((await state(h,a)).students[0].dropoffStopId,'STOP-03');
 assert.equal((await act(h,su,'review_change_demo',{requestId:id,demoPolicyApproved:true})).data.error,'REQUEST_NOT_PENDING');
});
test('UI168/HTTP11: CSS and browser app syntax pass node check',()=>{
 for(const relative of ['../mobile-session21/demo-hub.mjs','../mobile-session21/demo-ui.mjs','../mobile-session21/coordination-demo.mjs']){
  const file=fileURLToPath(new URL(relative,import.meta.url));
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(check.status,0,relative+': '+check.stderr);
 }
});
test.todo('UI168/REAL: shared local Node.js test sessions are NOT authenticated transport roles or a production database');
