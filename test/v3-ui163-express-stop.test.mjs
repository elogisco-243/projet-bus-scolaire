import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=x=>readFileSync(fileURLToPath(new URL(x,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs'),css=read('../mobile-session19/style.css');
const fixture=(count=2,declared=0)=>{
 const s=makeAttendantDemo();
 s.students=Array.from({length:count},(_,i)=>({
   id:'E-'+String(i+1).padStart(3,'0'),tripId:'TRIP-DEMO',mode:'demo',
   pickupStopId:'STOP-01',dropoffStopId:'STOP-03',
   absent:i>=count-declared,absenceReason:i>=count-declared?'family_notified':null,
   boarded:false,alighted:false
 }));
 return s;
};
function create(seed=makeAttendantDemo()){
 let callback;
 const root={innerHTML:'',addEventListener(event,fn){if(event==='click')callback=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo:()=>structuredClone(seed),runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:3000});
 const click=(action,arg='',tab=false)=>callback({target:{closest:()=>({
  disabled:false,dataset:tab?{tab:action}:{action,arg}
 })}});
 return {html:()=>root.innerHTML,click};
}
const ready=h=>{h.click('demo_prepare_departure');h.click('start_demo_trip');};
const arrive=h=>{ready(h);h.click('simulate_arrival');};
test('UI163/01: Arrêt express appears immediately after arrival (not after long page scroll)',()=>{
 const h=create();arrive(h);
 assert.match(h.html(),/role="region" aria-label="Arrêt express/);
 assert.match(h.html(),/DÉMO · ARRÊT EXPRESS/);
 assert.match(h.html(),/Dépôt/);
 assert.match(h.html(),/data-pupil="E-01"/);
});
test('UI163/02: preannounced parent absences disappear from active queue and remain counted',()=>{
 const h=create(fixture(15,3));arrive(h);
 assert.match(h.html(),/3<\/strong><span>Absences signalées/);
 assert.match(h.html(),/12 à traiter/);
 assert.doesNotMatch(h.html(),/data-pupil="E-015"/);
});
test('UI163/03: 5, 15, 30 and 50 children never render more than 4 active rows',()=>{
 for(const size of [5,15,30,50]){
  const h=create(fixture(size));arrive(h);
  const page=h.html(),rows=[...page.matchAll(/data-pupil="(E-[0-9]+)"/g)].map(x=>x[1]);
  assert.equal(rows.length,4);
  assert.deepEqual(rows,['E-001','E-002','E-003','E-004']);
  assert.match(page,new RegExp(size+' à traiter'));
 }
});
test('UI163/04: each pointage replaces its row with the next child, no scrolling',()=>{
 const h=create(fixture(30));arrive(h);
 h.click('board','E-001');const page=h.html();
 assert.doesNotMatch(page,/data-pupil="E-001"/);
 assert.match(page,/data-pupil="E-005"/);
 assert.match(page,/29 à traiter/);
 assert.match(page,/ÉLÈVES À BORD<\/span><strong>1<\/strong>/);
});
test('UI163/05: each child still requires an explicit confirmation, no bulk all-present action',()=>{
 const h=create(fixture(5));arrive(h);
 const page=h.html();
 assert.doesNotMatch(page,/data-action="bulk_confirm"|data-action="all_present"/);
 for(let i=1;i<=5;i++)h.click('board','E-'+String(i).padStart(3,'0'));
 assert.match(h.html(),/Pointage de cet arrêt terminé/);
 assert.match(h.html(),/5<\/strong>/);
});
test('UI163/06: pointage does not resume or move the bus automatically',()=>{
 const h=create();arrive(h);h.click('board','E-01');
 const page=h.html();
 assert.match(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.match(page,/Simuler reprise Chauffeur/);
 assert.match(page,/aucun départ automatique/);
 h.click('simulate_driver_resume');
 assert.match(h.html(),/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
});
test('UI163/07: preannounced absence needs no additional action and cannot be boarded',()=>{
 const s=fixture(5,2);
 let st=runAttendantDemo(s,'demo_prepare_departure');st=runAttendantDemo(st,'start_demo_trip');st=runAttendantDemo(st,'simulate_arrival');
 assert.equal(attendantSummary(st).pendingAtStop,3);
 assert.throws(()=>runAttendantDemo(st,'board',{studentId:'E-004'}),/REPORTED_ABSENT/);
});
test('UI163/08: immediately undo a mis-tap, and leave the original event in the audit',()=>{
 let s=fixture(5);s=runAttendantDemo(s,'demo_prepare_departure');s=runAttendantDemo(s,'start_demo_trip');s=runAttendantDemo(s,'simulate_arrival');
 s=runAttendantDemo(s,'board',{studentId:'E-001'});
 assert.equal(s.trip.onboardCount,1);
 const corrected=runAttendantDemo(s,'undo_last_pointage');
 assert.equal(corrected.trip.onboardCount,0);
 assert.equal(corrected.students[0].boarded,false);
 assert.ok(corrected.events.some(e=>e.type==='board'&&e.studentId==='E-001'));
 assert.equal(corrected.events.at(-1).type,'pointage_reverted');
 assert.throws(()=>runAttendantDemo(corrected,'undo_last_pointage'),/NO_REVERSIBLE_POINTAGE/);
});
test('UI163/09: undo is forbidden after leaving stop and for predeclared absence',()=>{
 let s=makeAttendantDemo();s=runAttendantDemo(s,'demo_prepare_departure');s=runAttendantDemo(s,'start_demo_trip');
 assert.throws(()=>runAttendantDemo(s,'undo_last_pointage'),/VEHICLE_NOT_SECURED_AT_STOP/);
 s=runAttendantDemo(s,'simulate_arrival');s=runAttendantDemo(s,'board',{studentId:'E-01'});
 s=runAttendantDemo(s,'simulate_driver_resume');
 assert.throws(()=>runAttendantDemo(s,'undo_last_pointage'),/VEHICLE_NOT_SECURED_AT_STOP/);
});
test('UI163/10: arrivals with both alighting and boarding prioritize alighting',()=>{
 const seed=fixture(5);
 seed.students[0].boarded=true;seed.students[0].pickupStopId='STOP-01';
 seed.students[0].dropoffStopId='STOP-01';
 seed.trip.onboardCount=1;
 const h=create(seed);arrive(h);
 const page=h.html();
 assert.match(page,/data-pupil="E-001"[^>]*>[\s\S]*?Descente attendue/);
 assert.match(page,/4<\/strong><span>Montées restantes/);
 assert.match(page,/1<\/strong><span>Descentes restantes/);
});
test('UI163/11: student with approved special guardian transfer cannot be marked alighted without handover',()=>{
 let s=makeAttendantDemo();s.students[0].approvedChangeId='APPROVED-DEMO-01';
 s=runAttendantDemo(s,'demo_prepare_departure');s=runAttendantDemo(s,'start_demo_trip');
 s=runAttendantDemo(s,'simulate_arrival');s=runAttendantDemo(s,'board',{studentId:'E-01'});
 s=runAttendantDemo(s,'simulate_driver_resume');s=runAttendantDemo(s,'simulate_arrival');
 s=runAttendantDemo(s,'mark_absent',{studentId:'E-02',reason:'non_present'});
 s=runAttendantDemo(s,'simulate_driver_resume');s=runAttendantDemo(s,'simulate_arrival');
 assert.throws(()=>runAttendantDemo(s,'alight',{studentId:'E-01'}),/HANDOVER_CONFIRMATION_REQUIRED/);
});
test('UI163/12: cancellation/alert conditions never bypass unfinished pupil checks',()=>{
 const h=create();arrive(h);h.click('incident','medical');
 assert.match(h.html(),/ALERTE ACTIVE/);
 h.click('board','E-01');
 assert.doesNotMatch(h.html(),/data-action="simulate_driver_resume"[^>]*class="express-resume"/);
 assert.match(h.html(),/Alerte ouverte : aucune reprise autorisée/);
});
test('UI163/13: queue is bounded by viewport, footer stays visible on short phones',()=>{
 assert.match(css,/\.express-overlay\{[\s\S]*?overflow:hidden/);
 assert.match(css,/\.express-queue\{[\s\S]*?overflow:hidden/);
 assert.match(css,/@media\(max-height:720px\)/);
 assert.match(css,/@media\(max-height:580px\)/);
 assert.match(css,/\.express-bottom\{flex:0 0 auto/);
});
test('UI163/14: only demo controls used, no real parent/badge access simulated',()=>{
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 const h=create();arrive(h);
 assert.match(h.html(),/DÉMO · ARRÊT EXPRESS/);
});
