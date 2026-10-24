import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const apply=(s,action,args)=>runAttendantDemo(s,action,args);
const prepared=()=>apply(apply(apply(makeAttendantDemo(),'confirm_presence'),'simulate_driver_secure'),'toggle_ready');
const started=()=>apply(prepared(),'start_demo_trip');
const at1=()=>apply(started(),'simulate_arrival');
const at2=()=>apply(apply(apply(at1(),'board',{studentId:'E-01'}),'simulate_driver_resume'),'simulate_arrival');
const at3=()=>apply(apply(apply(at2(),'mark_absent',{studentId:'E-02',reason:'non_present'}),'simulate_driver_resume'),'simulate_arrival');
const reconciled=()=>apply(at3(),'alight',{studentId:'E-01'});
test('UI155: initial role, two students, three stops and unaccounted pupils',()=>{
 const s=makeAttendantDemo(),d=attendantSummary(s);
 assert.equal(s.mode,'demo');assert.equal(s.session.role,'attendant');
 assert.equal(d.assigned,2);assert.equal(d.unaccounted,2);
 assert.equal(d.stopsTotal,3);assert.equal(d.stopsReached,0);
});
test('UI155: no start until presence + synthetic driver secure + readiness switch',()=>{
 assert.throws(()=>apply(makeAttendantDemo(),'start_demo_trip'),/DEPARTURE_NOT_AUTHORIZED/);
 const s=apply(makeAttendantDemo(),'confirm_presence');
 assert.throws(()=>apply(s,'toggle_ready'),/READY_PRECONDITIONS_NOT_MET/);
 const safe=apply(s,'simulate_driver_secure');
 assert.throws(()=>apply(safe,'start_demo_trip'),/DEPARTURE_NOT_AUTHORIZED/);
 assert.equal(attendantSummary(prepared()).canStart,true);
 const startedTrip=started();
 assert.equal(startedTrip.trip.status,'in_progress');
 assert.equal(attendantSummary(startedTrip).driverSecured,false);
});
test('UI155: switch can be turned off and cannot be changed while driving',()=>{
 assert.equal(attendantSummary(apply(prepared(),'toggle_ready')).ready,false);
 assert.throws(()=>apply(started(),'toggle_ready'),/READY_PRECONDITIONS_NOT_MET/);
});
test('UI155: no duplicate presence',()=>assert.throws(()=>apply(apply(makeAttendantDemo(),'confirm_presence'),'confirm_presence'),/ALREADY_CONFIRMED/));
test('UI155: one synthetic arrival activates a single stop and enables pointage',()=>{
 const s=at1(),d=attendantSummary(s);
 assert.equal(d.activeStopId,'STOP-01');
 assert.equal(d.pendingAtStop,1);
 assert.equal(d.atStop,true);
 assert.equal(d.driverSecured,true);
 assert.throws(()=>apply(s,'simulate_arrival'),/STOP_CURRENTLY_ACTIVE/);
});
test('UI155: pointage cannot occur on moving vehicle or at wrong stop',()=>{
 assert.throws(()=>apply(started(),'board',{studentId:'E-01'}),/VEHICLE_NOT_SECURED_AT_STOP/);
 assert.throws(()=>apply(at1(),'board',{studentId:'E-02'}),/WRONG_PICKUP_STOP/);
 assert.throws(()=>apply(apply(at1(),'board',{studentId:'E-01'}),'alight',{studentId:'E-01'}),/WRONG_DROPOFF_STOP/);
});
test('UI155: cannot resume while scheduled pupil has not been pointed',()=>{
 assert.throws(()=>apply(at1(),'simulate_driver_resume'),/POINTAGE_PENDING_AT_STOP/);
});
test('UI155: one tap boards at assigned stop; duplicate blocked',()=>{
 const s=apply(at1(),'board',{studentId:'E-01'});
 assert.equal(attendantSummary(s).onboard,1);
 assert.equal(attendantSummary(s).pendingAtStop,0);
 assert.throws(()=>apply(s,'board',{studentId:'E-01'}),/DUPLICATE_BOARDING/);
});
test('UI155: absence requires explicit fixed demo reason at assigned pickup',()=>{
 assert.throws(()=>apply(at2(),'mark_absent',{studentId:'E-02'}),/ABSENCE_REASON_REQUIRED/);
 const s=apply(at2(),'mark_absent',{studentId:'E-02',reason:'non_present'});
 assert.equal(s.students[1].absenceReason,'non_present');
 assert.throws(()=>apply(s,'board',{studentId:'E-02'}),/REPORTED_ABSENT/);
 assert.throws(()=>apply(s,'mark_absent',{studentId:'E-02',reason:'non_present'}),/ALREADY_ABSENT/);
});
test('UI155: cannot mark boarded pupil absent',()=>{
 const s=apply(at1(),'board',{studentId:'E-01'});
 assert.throws(()=>apply(s,'mark_absent',{studentId:'E-01',reason:'non_present'}),/ALREADY_BOARDED/);
});
test('UI155: arrival advances route and pointage only at current stop',()=>{
 const d=attendantSummary(at3());
 assert.equal(d.stopsReached,3);assert.equal(d.stopsTotal,3);
 assert.equal(d.activeStopId,'STOP-03');assert.equal(d.pendingAtStop,1);
});
test('UI155: third stop dropoff resolves expected pupil',()=>{
 const s=reconciled(),d=attendantSummary(s);
 assert.equal(d.onboard,0);assert.equal(d.unaccounted,0);assert.equal(d.pendingAtStop,0);
 assert.throws(()=>apply(s,'alight',{studentId:'E-01'}),/DUPLICATE_ALIGHTING/);
 assert.throws(()=>apply(s,'simulate_driver_resume'),/ALREADY_AT_TERMINUS/);
});
test('UI155: same six driver alert categories',()=>{
 assert.deepEqual(INCIDENTS.map(x=>x[0]),['Embouteillage','Retard','Panne','Accident','Urgence médicale','Enfant manquant']);
 assert.deepEqual(CRITICAL_INCIDENTS,['accident','medical','missing_child']);
});
test('UI155: ordinary incident requires stop but critical accessible in motion',()=>{
 assert.throws(()=>apply(started(),'report_incident',{incident:'delay'}),/VEHICLE_NOT_SECURED_AT_STOP/);
 const s=apply(started(),'report_incident',{incident:'medical'});
 assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].critical,true);
 assert.equal(s.alerts[0].delivery,'LOCAL_SIMULATION_ONLY');
});
test('UI155: critical incident accessible before departure but never sends externally',()=>{
 const s=apply(makeAttendantDemo(),'report_incident',{incident:'missing_child'});
 assert.equal(s.alerts[0].delivery,'LOCAL_SIMULATION_ONLY');
 assert.equal(attendantSummary(s).pendingRealSync,0);
});
test('UI155: incident resolution restricted to secured active stop',()=>{
 let s=apply(started(),'report_incident',{incident:'accident'});
 assert.throws(()=>apply(s,'resolve_incident',{incidentId:s.alerts[0].id}),/VEHICLE_NOT_SECURED_AT_STOP/);
 s=apply(s,'simulate_arrival');s=apply(s,'resolve_incident',{incidentId:s.alerts[0].id});
 assert.equal(attendantSummary(s).openAlerts,0);
});
test('UI155: closure requires all pupils, no open incident and final bus inspection',()=>{
 assert.throws(()=>apply(at1(),'finish_demo_trip'),/ROUTE_NOT_COMPLETED|STUDENTS_NOT_RECONCILED/);
 const s=reconciled();
 assert.throws(()=>apply(s,'finish_demo_trip'),/EMPTY_BUS_CONFIRMATION_REQUIRED/);
 const withAlert=apply(s,'report_incident',{incident:'delay'});
 assert.throws(()=>apply(withAlert,'finish_demo_trip'),/OPEN_INCIDENTS/);
 const after=apply(withAlert,'resolve_incident',{incidentId:withAlert.alerts[0].id});
 const empty=apply(after,'confirm_empty');
 assert.equal(attendantSummary(empty).canFinish,true);
 const done=apply(empty,'finish_demo_trip');
 assert.equal(done.trip.status,'completed');
});
test('UI155: final inspection is refused while any pupil is still aboard',()=>{
 const s=at3();
 assert.throws(()=>apply(s,'confirm_empty'),/CHILDREN_REMAIN/);
 const after=apply(s,'alight',{studentId:'E-01'});
 const checked=apply(after,'confirm_empty');
 assert.equal(attendantSummary(checked).canFinish,true);
 assert.throws(()=>apply(checked,'confirm_empty'),/ALREADY_CONFIRMED/);
});
test('UI155: cannot declare empty while pupils remain',()=>assert.throws(()=>apply(at3(),'confirm_empty'),/CHILDREN_REMAIN/));
test('UI155: no real sync when network simulated offline',()=>{
 let s=apply(at1(),'simulate_network_loss');
 s=apply(s,'report_incident',{incident:'delay'});
 assert.equal(s.network,'simulated-offline');
 assert.equal(attendantSummary(s).pendingRealSync,0);
});
test('UI155: strict DEMO / operational boundary and no driver privileges',()=>{
 const s=at1();s.mode='operational';
 assert.throws(()=>apply(s,'board',{studentId:'E-01'}),/DEMO_ONLY/);
 assert.throws(()=>apply(at1(),'assign_vehicle'),/ACTION_DENIED/);
});
test('UI155: immutable demo state snapshots',()=>{
 const s=at1(),next=apply(s,'board',{studentId:'E-01'});
 assert.equal(s.trip.onboardCount,0);assert.equal(next.trip.onboardCount,1);
 assert.equal(s.students[0].boarded,false);
});
