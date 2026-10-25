import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,
 INCIDENTS,CRITICAL_INCIDENTS
} from '../mobile-session19/attendant-demo.mjs';
const ui=readFileSync(fileURLToPath(new URL('../mobile-session19/app.mjs',import.meta.url)),'utf8');
const seedRandom=(seed)=>()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const apply=(s,action,opts={})=>runAttendantDemo(s,action,opts);
const verify=(s)=>{
 assert.equal(s.mode,'demo');
 assert.equal(s.session.role,'attendant');
 const count=s.students.filter(p=>p.boarded&&!p.alighted).length;
 assert.equal(s.trip.onboardCount,count);
 assert.equal(attendantSummary(s).onboard,count);
 assert.ok(count>=0&&count<=s.students.length);
 assert.ok(s.stops.every((p,i)=>i===0||!p.reached||s.stops[i-1].reached));
 if(s.atStop){
  assert.ok(s.activeStopId);
  assert.equal(s.stops.find(p=>p.id===s.activeStopId)?.reached,true);
  assert.equal(s.driverSecured,true);
 }
 for(const p of s.students){
  assert.equal(Boolean(p.absent&&p.boarded),false);
  if(p.alighted)assert.equal(p.boarded,true);
  if(p.absent)assert.ok(['non_present','family_notified'].includes(p.absenceReason));
 }
 if(s.trip.status==='completed'){
  assert.equal(count,0);
  assert.ok(s.stops.every(p=>p.reached));
  assert.ok(attendantClosingChecklist(s).every(c=>c.ok));
  assert.ok(s.events.some(e=>e.type==='empty_bus_confirmed'));
  assert.ok(s.alerts.every(a=>a.status!=='open'));
 }
 assert.ok(s.events.every(e=>e.delivery==='LOCAL_SIMULATION_ONLY'));
};
test('SAFETY/01: 10 x 420 adversarial action attempts preserve core invariants',()=>{
 for(let seed=1;seed<=10;seed++){
  let s=makeAttendantDemo(),rand=seedRandom(seed);
  for(let n=0;n<420;n++){
   const n0=Math.floor(rand()*16);
   const action=[
    'demo_prepare_departure','start_demo_trip','simulate_arrival',
    'simulate_driver_resume','board','alight','mark_absent','report_incident',
    'resolve_incident','demo_confirm_empty_and_finish','confirm_empty',
    'simulate_network_loss','simulate_network_return','toggle_ready',
    'simulate_driver_secure','finish_demo_trip'
   ][n0];
   const p=s.students[Math.floor(rand()*s.students.length)];
   const incident=INCIDENTS[Math.floor(rand()*INCIDENTS.length)][1];
   const open=s.alerts.filter(a=>a.status==='open');
   const opts={studentId:p.id,reason:'non_present',incident,incidentId:open.length?open[Math.floor(rand()*open.length)].id:'NONE'};
   const before=JSON.stringify(s);
   try{
    const next=apply(s,action,opts);
    // State transitions are immutable and never silently mutate the old snapshot.
    assert.equal(JSON.stringify(s),before);
    s=next;
   }catch(err){
    assert.equal(JSON.stringify(s),before);
    assert.ok(typeof err.message==='string'&&err.message.length>0);
   }
   verify(s);
  }
 }
});
test('SAFETY/02: no phantom onboard count from unread route or unreported absence',()=>{
 let s=apply(makeAttendantDemo(),'demo_prepare_departure');
 s=apply(s,'start_demo_trip');s=apply(s,'simulate_arrival');
 assert.equal(attendantSummary(s).onboard,0);
 assert.equal(attendantSummary(s).pendingAtStop,1);
 verify(s);
});
test('SAFETY/03: no closing of a trip with any child aboard even after final stop',()=>{
 let s=apply(makeAttendantDemo(),'demo_prepare_departure');
 s=apply(s,'start_demo_trip');s=apply(s,'simulate_arrival');
 s=apply(s,'board',{studentId:'E-01'});
 s=apply(s,'simulate_driver_resume');s=apply(s,'simulate_arrival');
 s=apply(s,'mark_absent',{studentId:'E-02',reason:'non_present'});
 s=apply(s,'simulate_driver_resume');s=apply(s,'simulate_arrival');
 assert.throws(()=>apply(s,'demo_confirm_empty_and_finish'),/STUDENTS_NOT_RECONCILED|CHILDREN_REMAIN/);
});
test('SAFETY/04: missing child critical report blocks departure until resolved',()=>{
 let s=apply(makeAttendantDemo(),'report_incident',{incident:'missing_child'});
 assert.throws(()=>apply(s,'demo_prepare_departure'),/OPEN_INCIDENTS/);
 s=apply(s,'simulate_driver_secure');
 s=apply(s,'resolve_incident',{incidentId:s.alerts[0].id});
 s=apply(s,'demo_prepare_departure');
 s=apply(s,'start_demo_trip');
 assert.equal(s.trip.status,'in_progress');
});
test('SAFETY/05: pre-start critical alert shows secure confirmation on the actual UI',()=>{
 let clickHandler,root={innerHTML:'',addEventListener(n,h){if(n==='click')clickHandler=h;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:3000});
 const click=(action,arg='')=>clickHandler({target:{closest:()=>({disabled:false,dataset:{action,arg}})}});
 click('incident','missing_child');click('go_alerts');
 assert.match(root.innerHTML,/Confirmer bus immobilisé \(démo\)/);
 click('simulate_driver_secure');
 const incidentId=root.innerHTML.match(/data-action="resolve_incident" data-arg="([^"]+)"/)?.[1];
 assert.ok(incidentId);
 click('resolve_incident',incidentId);click('back_tour');
 click('demo_prepare_departure');click('start_demo_trip');
 assert.match(root.innerHTML,/trip-state state-running/);
});
test('SAFETY/06: rejected wrong stop, fake child, and duplicate operations never change inputs',()=>{
 let s=apply(makeAttendantDemo(),'demo_prepare_departure');
 s=apply(s,'start_demo_trip');s=apply(s,'simulate_arrival');
 const old=JSON.stringify(s);
 for(const args of [{studentId:'UNKNOWN'},{studentId:'E-02'}]){
  assert.throws(()=>apply(s,'board',args));
  assert.equal(JSON.stringify(s),old);
 }
 s=apply(s,'board',{studentId:'E-01'});
 const newState=JSON.stringify(s);
 assert.throws(()=>apply(s,'board',{studentId:'E-01'}),/DUPLICATE_BOARDING/);
 assert.equal(JSON.stringify(s),newState);
});
