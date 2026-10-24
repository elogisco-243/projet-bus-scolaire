import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const apply=(s,action,args)=>runAttendantDemo(s,action,args);
const prepared=()=>apply(apply(apply(makeAttendantDemo(),'confirm_presence'),'simulate_driver_secure'),'toggle_ready');
const started=()=>apply(prepared(),'start_demo_trip');
const stopped=()=>apply(started(),'simulate_driver_secure');
const routeDone=(s)=>{
 for(let i=0;i<s.stops.length;i++){
  s=apply(s,'reach_stop');
  s=apply(s,'simulate_driver_secure');
 }
 return s;
};
const reconciled=()=>{
 let s=stopped();
 s=apply(s,'board',{studentId:'E-01'});
 s=apply(s,'alight',{studentId:'E-01'});
 s=apply(s,'mark_absent',{studentId:'E-02'});
 return s;
};
test('UI154: empty initial demo, two assigned pupils and three fake stops',()=>{
 const s=makeAttendantDemo(),d=attendantSummary(s);
 assert.equal(d.onboard,0);assert.equal(d.unaccounted,2);
 assert.equal(d.stopsReached,0);assert.equal(d.stopsTotal,3);
 assert.equal(s.mode,'demo');
});
test('UI154: departure blocked until attendance, synthetic driver safety, and readiness switch',()=>{
 assert.throws(()=>apply(makeAttendantDemo(),'start_demo_trip'),/DEPARTURE_NOT_AUTHORIZED/);
 const present=apply(makeAttendantDemo(),'confirm_presence');
 assert.throws(()=>apply(present,'toggle_ready'),/READY_PRECONDITIONS_NOT_MET/);
 const secured=apply(present,'simulate_driver_secure');
 assert.equal(attendantSummary(secured).canToggleReady,true);
 assert.throws(()=>apply(secured,'start_demo_trip'),/DEPARTURE_NOT_AUTHORIZED/);
 assert.equal(started().trip.status,'in_progress');
});
test('UI154: readiness switch can toggle, disabled during actual simulated drive',()=>{
 const p=prepared();
 assert.equal(attendantSummary(p).ready,true);
 assert.equal(attendantSummary(apply(p,'toggle_ready')).ready,false);
 const s=apply(p,'start_demo_trip');
 assert.equal(attendantSummary(s).ready,false);
 assert.equal(attendantSummary(s).driverSecured,false);
 assert.throws(()=>apply(s,'toggle_ready'),/READY_PRECONDITIONS_NOT_MET/);
});
test('UI154: duplicate presence refused',()=>assert.throws(()=>apply(apply(makeAttendantDemo(),'confirm_presence'),'confirm_presence'),/ALREADY_CONFIRMED/));
test('UI154: no pointage while bus not declared stationary, and proper count at stop',()=>{
 const moving=started();
 assert.throws(()=>apply(moving,'board',{studentId:'E-01'}),/VEHICLE_NOT_SECURED/);
 let s=apply(moving,'simulate_driver_secure');
 s=apply(s,'board',{studentId:'E-01'});
 assert.equal(attendantSummary(s).onboard,1);
 s=apply(s,'alight',{studentId:'E-01'});
 assert.equal(attendantSummary(s).onboard,0);
});
test('UI154: cannot alight before boarding',()=>assert.throws(()=>apply(stopped(),'alight',{studentId:'E-02'}),/NOT_BOARDED/));
test('UI154: duplicate boarding refused',()=>{
 const s=apply(stopped(),'board',{studentId:'E-01'});
 assert.throws(()=>apply(s,'board',{studentId:'E-01'}),/DUPLICATE_BOARDING/);
});
test('UI154: absent pupils cannot board, nor can a boarded pupil be marked absent',()=>{
 const absent=apply(stopped(),'mark_absent',{studentId:'E-02'});
 assert.throws(()=>apply(absent,'board',{studentId:'E-02'}),/REPORTED_ABSENT/);
 assert.throws(()=>apply(absent,'mark_absent',{studentId:'E-02'}),/ALREADY_ABSENT/);
 const onboard=apply(stopped(),'board',{studentId:'E-01'});
 assert.throws(()=>apply(onboard,'mark_absent',{studentId:'E-01'}),/ALREADY_BOARDED/);
});
test('UI154: stop is sequential and fresh stationary signal is mandatory each time',()=>{
 let s=stopped();
 s=apply(s,'reach_stop');
 assert.equal(attendantSummary(s).nextStop,'Arrêt fictif A');
 assert.equal(attendantSummary(s).stopsReached,1);
 assert.throws(()=>apply(s,'reach_stop'),/VEHICLE_NOT_SECURED/);
 s=routeDoneFromPartial(s);
 assert.equal(attendantSummary(s).stopsReached,3);
 assert.throws(()=>apply(s,'reach_stop'),/ALL_STOPS_REACHED/);
});
function routeDoneFromPartial(s){
 while(s.stops.some(x=>!x.reached)){
  s=apply(s,'simulate_driver_secure');
  s=apply(s,'reach_stop');
 }
 return apply(s,'simulate_driver_secure');
}
test('UI154: six alert categories match chauffeur reference',()=>{
 assert.deepEqual(INCIDENTS.map(x=>x[0]),['Embouteillage','Retard','Panne','Accident','Urgence médicale','Enfant manquant']);
});
test('UI154: cannot alert until stationary; alerts never sent remotely',()=>{
 assert.throws(()=>apply(started(),'report_incident',{incident:'medical'}),/VEHICLE_NOT_SECURED/);
 const s=apply(stopped(),'report_incident',{incident:'medical'});
 assert.equal(s.events.at(-1).delivery,'LOCAL_SIMULATION_ONLY');
 assert.equal(s.alert,'medical');
});
test('UI154: cannot close while pupils remain aboard',()=>{
 const s=apply(stopped(),'board',{studentId:'E-01'});
 assert.throws(()=>apply(s,'finish_demo_trip'),/FINISH_BLOCKED/);
});
test('UI154: cannot close without itinerary or without resolving every pupil',()=>{
 let s=reconciled();
 assert.throws(()=>apply(s,'finish_demo_trip'),/ROUTE_NOT_COMPLETED/);
 s=routeDone(s);
 assert.throws(()=>apply(s,'finish_demo_trip'),/EMPTY_BUS_CONFIRMATION_REQUIRED/);
 let unresolved=routeDone(stopped());
 unresolved=apply(unresolved,'confirm_empty');
 assert.throws(()=>apply(unresolved,'finish_demo_trip'),/STUDENTS_NOT_RECONCILED/);
});
test('UI154: full pointage, absence, route and empty check permit closure',()=>{
 let s=routeDone(reconciled());
 s=apply(s,'confirm_empty');
 s=apply(s,'finish_demo_trip');
 assert.equal(s.trip.status,'completed');
 assert.equal(attendantSummary(s).unaccounted,0);
});
test('UI154: changed pointage invalidates earlier final empty confirmation',()=>{
 let s=stopped();
 s=apply(s,'confirm_empty');
 s=apply(s,'board',{studentId:'E-01'});
 s=apply(s,'alight',{studentId:'E-01'});
 s=apply(s,'mark_absent',{studentId:'E-02'});
 s=routeDone(s);
 assert.throws(()=>apply(s,'finish_demo_trip'),/EMPTY_BUS_CONFIRMATION_REQUIRED/);
});
test('UI154: offline simulation never claims real sync',()=>{
 let s=apply(stopped(),'simulate_network_loss');
 s=apply(s,'report_incident',{incident:'delay'});
 assert.equal(s.network,'simulated-offline');
 assert.equal(attendantSummary(s).pendingRealSync,0);
});
test('UI154: denied operational-mode crossover and invalid student',()=>{
 const s=stopped();s.mode='operational';
 assert.throws(()=>apply(s,'report_incident',{incident:'delay'}),/DEMO_ONLY/);
 assert.throws(()=>apply(stopped(),'board',{studentId:'OTHER'}),/STUDENT_NOT_ON_TRIP/);
});
test('UI154: attendant cannot gain driver privilege, state is immutable snapshot',()=>{
 const s=stopped();
 assert.throws(()=>apply(s,'assign_vehicle'),/ACTION_DENIED/);
 const next=apply(s,'board',{studentId:'E-01'});
 assert.equal(s.trip.onboardCount,0);
 assert.equal(next.trip.onboardCount,1);
});
