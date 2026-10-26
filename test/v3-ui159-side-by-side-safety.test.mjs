import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 accounts,makeState,startTrip,advanceTrip,setDriverOnline,boardStudent,finishTrip,
 reportIncident,resolveIncident,tripOf,visibleTrips
} from '../frontend/src/domain.mjs';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
import {authorizeAttendant,attendantCanOperateVehicle} from '../mobile-session18/attendant-policy.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const build=read('../scripts/build-attendant-testhost.mjs');
function makeUI(initial=makeAttendantDemo()){
 let clickHandler;
 const root={innerHTML:'',addEventListener(event,fn){if(event==='click')clickHandler=fn;}};
 const localDemo=()=>structuredClone(initial);
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo:localDemo,
  runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:3000});
 return {
  html:()=>root.innerHTML,
  click:(action,arg='',isTab=false)=>{
   const el={disabled:false,dataset:isTab?{tab:action}:{action,arg}};
   clickHandler({target:{closest:()=>el}});
  },
  clickIfEnabled:(action,arg='')=>{
   const html=root.innerHTML;
   const button=html.match(new RegExp('<button\\b[^>]*data-action="'+action+'"[^>]*>'));
   assert.ok(button,action+' must be rendered');
   if(/\bdisabled\b/.test(button[0]))return false;
   clickHandler({target:{closest:()=>({disabled:false,dataset:{action,arg}})}});
   return true;
  }
 };
}
const driverStart=()=>startTrip(makeState(),accounts.driver,'TRIP-A');
const attendantStart=()=>{
 let s=runAttendantDemo(makeAttendantDemo(),'demo_prepare_departure');
 s=runAttendantDemo(s,'start_demo_trip');
 return s;
};
const driverStop=s=>advanceTrip(s,accounts.driver,'TRIP-A');
const attendStop=s=>runAttendantDemo(s,'simulate_arrival');

test('PAIR/01: both demos start planned then become in_progress by explicitly initiated action',()=>{
 const d=driverStart(),a=attendantStart();
 assert.equal(tripOf(d,'TRIP-A').status,'in_progress');
 assert.equal(a.trip.status,'in_progress');
});
test('PAIR/02: driver starts only assigned trip; attendant cannot gain vehicle action rights',()=>{
 assert.throws(()=>startTrip(makeState(),accounts.driver,'TRIP-C'),/non autorisée/);
 assert.equal(attendantCanOperateVehicle(),false);
 assert.throws(()=>runAttendantDemo(makeAttendantDemo(),'assign_vehicle'),/ACTION_DENIED/);
});
test('PAIR/03: duplicate start blocked on both sides',()=>{
 const d=driverStart(),a=attendantStart();
 assert.throws(()=>startTrip(d,accounts.driver,'TRIP-A'),/ne peut plus/);
 assert.throws(()=>runAttendantDemo(a,'start_demo_trip'),/DEPARTURE_NOT_AUTHORIZED/);
});
test('PAIR/04: driver prototype advances only in_progress; attendant only in_progress',()=>{
 assert.throws(()=>driverStop(makeState()),/Démarre/);
 assert.throws(()=>attendStop(makeAttendantDemo()),/TRIP_NOT_ACTIVE/);
 assert.equal(tripOf(driverStop(driverStart()),'TRIP-A').progress,25);
 assert.equal(attendantSummary(attendStop(attendantStart())).stopsReached,1);
});
test('PAIR/05: count of route stops differs: no cross-account consistency can be inferred',()=>{
 const d=driverStart(),a=attendantStart();
 const driverRoute=d.routes.find(r=>r.id==='ROU-A');
 assert.equal(driverRoute.stops.length,4);
 assert.equal(a.stops.length,3);
 assert.notEqual(tripOf(d,'TRIP-A').id,a.trip.id);
});
test('PAIR/06: driver legacy and attendant demo both reject duplicate pupil boarding',()=>{
 let d=boardStudent(driverStart(),accounts.driver,'TRIP-A','ST-A');
 assert.throws(()=>boardStudent(d,accounts.driver,'TRIP-A','ST-A'),/déjà confirmée/);
 let a=attendStop(attendantStart());
 a=runAttendantDemo(a,'board',{studentId:'E-01'});
 assert.throws(()=>runAttendantDemo(a,'board',{studentId:'E-01'}),/DUPLICATE_BOARDING/);
});
test('PAIR/07: cross-route pupil rejected; attendant wrong stop rejected',()=>{
 const d=driverStart(),a=attendStop(attendantStart());
 assert.throws(()=>boardStudent(d,accounts.driver,'TRIP-A','ST-C'),/non autorisé/);
 assert.throws(()=>runAttendantDemo(a,'board',{studentId:'E-02'}),/WRONG_PICKUP_STOP/);
});
test('PAIR/08: reconciliation is explicit in attendant demo and never fake pupil alighting',()=>{
 let s=attendStop(attendantStart());s=runAttendantDemo(s,'board',{studentId:'E-01'});
 assert.equal(attendantSummary(s).onboard,1);
 assert.throws(()=>runAttendantDemo(s,'alight',{studentId:'E-01'}),/WRONG_DROPOFF_STOP/);
 assert.equal(s.students[0].alighted,false);
});
test('PAIR/09: pending pointage prohibits attendant resume and two stop claims',()=>{
 const s=attendStop(attendantStart());
 assert.throws(()=>runAttendantDemo(s,'simulate_driver_resume'),/POINTAGE_PENDING_AT_STOP/);
 assert.throws(()=>runAttendantDemo(s,'simulate_arrival'),/STOP_CURRENTLY_ACTIVE/);
});
test('PAIR/10: while vehicle moving, attendant boarding blocked and ordinary alert blocked',()=>{
 const s=attendantStart();
 assert.throws(()=>runAttendantDemo(s,'board',{studentId:'E-01'}),/VEHICLE_NOT_SECURED_AT_STOP/);
 assert.throws(()=>runAttendantDemo(s,'report_incident',{incident:'delay'}),/VEHICLE_NOT_SECURED_AT_STOP/);
});
test('PAIR/11: critical alert can be entered while moving but not sent to external emergency service',()=>{
 const s=runAttendantDemo(attendantStart(),'report_incident',{incident:'medical'});
 assert.equal(s.alerts[0].critical,true);
 assert.equal(s.alerts[0].delivery,'LOCAL_SIMULATION_ONLY');
 assert.equal(attendantSummary(s).pendingRealSync,0);
});
test('PAIR/12: critical alert blocks resumed trip after pupils are checked',()=>{
 let s=attendStop(attendantStart());
 s=runAttendantDemo(s,'board',{studentId:'E-01'});
 s=runAttendantDemo(s,'report_incident',{incident:'medical'});
 assert.equal(attendantSummary(s).canResume,false);
 assert.throws(()=>runAttendantDemo(s,'simulate_driver_resume'),/OPEN_CRITICAL_INCIDENT/);
});
test('PAIR/13: driver legacy demo itself supports in-progress warning and only operator resolves',()=>{
 let d=reportIncident(driverStart(),accounts.driver,'TRIP-A','Retard fictif','warning');
 const id=d.incidents[0].id;
 assert.throws(()=>resolveIncident(d,accounts.driver,id),/non autorisé/);
 d=resolveIncident(d,accounts.operator,id);
 assert.equal(d.incidents[0].status,'resolved');
});
test('PAIR/14: attendant DEMO session refuses forged mode and role',()=>{
 const s=attendStop(attendantStart());s.session.role='driver';
 assert.throws(()=>runAttendantDemo(s,'board',{studentId:'E-01'}),/ROLE_DENIED/);
});
test('PAIR/15: no cross-environment use and no other organization access',()=>{
 const s=attendantStart();s.mode='operational';
 assert.throws(()=>runAttendantDemo(s,'simulate_arrival'),/DEMO_ONLY/);
 const real={ok:true,mode:'operational',role:'attendant',attendantId:'A1',serverVerified:true,subject:'u',organizationId:'ORG1'};
 const trip={id:'T',mode:'operational',attendantId:'A1',organizationId:'ORG2',status:'in_progress'};
 assert.equal(authorizeAttendant({session:real,trip,action:'view_trip'}).code,'OTHER_ORGANIZATION');
});
test('PAIR/16: genuine browser UI disables start until one demo switch, then enables it',()=>{
 const h=makeUI();assert.equal(h.clickIfEnabled('start_demo_trip'),false);
 h.click('demo_prepare_departure');
 assert.equal(h.clickIfEnabled('start_demo_trip'),true);
 assert.match(h.html(),/trip-state state-running/);
});
test('PAIR/17: Start and Arrêt atteint enabled colors contrast with grayed disabled',()=>{
 assert.match(css,/\.dashboard-actions \.dash-action:disabled\{/);
 assert.match(css,/\.dashboard-actions \.dash-action\.primary:not\(:disabled\)\{/);
 assert.match(css,/background:linear-gradient\(125deg,#7228cd,#5e1bad\)!important/);
 assert.match(css,/\.dashboard-actions \.dash-action\.warn:not\(:disabled\)\{/);
 assert.match(css,/background:#ffd65b!important/);
});
test('PAIR/18: ARRÊT ATTEINT only becomes enabled after start, not just readiness',()=>{
 const h=makeUI();
 h.click('demo_prepare_departure');
 assert.equal(h.clickIfEnabled('simulate_arrival'),false);
 h.click('start_demo_trip');
 assert.equal(h.clickIfEnabled('simulate_arrival'),true);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
});
test('PAIR/19: one tap on student bubble points and returns without extra menu',()=>{
 const h=makeUI();h.click('demo_prepare_departure');h.click('start_demo_trip');
 h.click('simulate_arrival');h.click('go_students');h.click('board','E-01');
 assert.match(h.html(),/ÉLÈVES À BORD<\/span><strong>1<\/strong>/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.doesNotMatch(h.html(),/Pointage des élèves<\/h2>/);
});
test('PAIR/20: empty stop needs explicit driver resume, even with no pupil to point',()=>{
 const seeded=makeAttendantDemo();
 seeded.students[0].pickupStopId='STOP-02';
 seeded.students[1].pickupStopId='STOP-02';
 const h=makeUI(seeded);h.click('demo_prepare_departure');h.click('start_demo_trip');
 h.click('simulate_arrival');
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.doesNotMatch(h.html(),/indicator-pending/);
 assert.equal(h.clickIfEnabled('simulate_arrival'),false);
 assert.equal(h.clickIfEnabled('simulate_driver_resume'),true);
 assert.equal(h.clickIfEnabled('simulate_arrival'),true);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>2\/3/);
});
test('PAIR/21: critical alert resolution unblocks only an explicit driver resume',()=>{
 const h=makeUI();h.click('demo_prepare_departure');h.click('start_demo_trip');
 h.click('simulate_arrival');
 h.click('incident','medical');h.click('go_students');h.click('board','E-01');
 assert.match(h.html(),/ALERTE ACTIVE/);
 assert.equal(h.clickIfEnabled('simulate_arrival'),false);
 h.click('go_alerts');
 const m=h.html().match(/data-action="resolve_incident" data-arg="([^"]+)"/);
 assert.ok(m);
 h.click('resolve_incident',m[1]);
 assert.doesNotMatch(h.html(),/ALERTE ACTIVE/);
 h.click('tour','',true);
 assert.equal(h.clickIfEnabled('simulate_arrival'),false);
 h.click('simulate_driver_resume');
 assert.equal(h.clickIfEnabled('simulate_arrival'),true);
});
test('PAIR/22: cannot close until all stops, pupils and empty bus explicit confirmation',()=>{
 let a=attendantStart();
 assert.throws(()=>runAttendantDemo(a,'demo_confirm_empty_and_finish'),/VEHICLE_NOT_SECURED_AT_STOP/);
 a=attendStop(a);
 assert.throws(()=>runAttendantDemo(a,'demo_confirm_empty_and_finish'),/ROUTE_NOT_COMPLETED/);
});
test('PAIR/23: local DEMO cannot claim synced events even if network simulated online',()=>{
 const a=attendantStart();
 assert.equal(attendantSummary(a).pendingRealSync,0);
 assert.match(build,/connect-src 'none'/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
test('PAIR/24: route snapshots are immutable, operations do not mutate previous state',()=>{
 const start=attendantStart();
 const next=attendStop(start);
 assert.equal(start.stops[0].reached,false);assert.equal(next.stops[0].reached,true);
});
test('PAIR/25: all four driver-style tiles and four tabs are present on attendant',()=>{
 const page=makeUI().html();
 for(const label of ['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE','Ma tournée','Alertes','Équipe','Plus'])assert.match(page,new RegExp(label));
 assert.equal((page.match(/dash-action/g)||[]).length,4);
});
test('PAIR/26: identity of Android testhost cannot collide with driver package',()=>{
 assert.match(build,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.match(build,/LOCAL_SIMULATION_ONLY/);
});
test.todo('BLOCKER: driver v1.7 runtime and its original UI resources required for true Android side-by-side comparison');
test.todo('BLOCKER: two authenticated devices must share confirmed events and server-side cross-validation');
test.todo('BLOCKER: legacy frontend Chauffeur demo must reject closing with pupils still onboard; not Chauffeur v1.7');
test.todo('BLOCKER: validate real security controls (server JWT/OIDC, assignments, idempotency, audit, RLS, encrypted storage)');
