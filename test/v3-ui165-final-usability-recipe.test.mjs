/**
 * UI-165 — DEMO-only final acceptance rehearsal.
 * Simulates taps / HTML after each action, not time spent physically handling
 * pupils; do not interpret Node runtimes as human usability measurements.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  makeAttendantDemo,runAttendantDemo,attendantSummary,
  attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
} from '../mobile-session19/attendant-demo.mjs';
const ui=readFileSync(fileURLToPath(new URL('../mobile-session19/app.mjs',import.meta.url)),'utf8');
const css=readFileSync(fileURLToPath(new URL('../mobile-session19/style.css',import.meta.url)),'utf8');
const pupil=(id,pickupStopId='STOP-01',dropoffStopId='STOP-03',absent=false)=>({
 id,tripId:'TRIP-DEMO',mode:'demo',pickupStopId,dropoffStopId,
 absent,absenceReason:absent?'family_notified':null,
 boarded:false,alighted:false
});
const makeSeed=(size=15,predeclared=0)=>{
 const s=makeAttendantDemo();
 s.students=Array.from({length:size},(_,i)=>pupil('S-'+String(i+1).padStart(3,'0'),
  'STOP-01','STOP-03',i<size&&i>=size-predeclared));
 return s;
};
function mounted(seed=makeSeed()){
 const root={innerHTML:'',addEventListener(type,fn){if(type==='click')click=fn;}};
 let click;
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},
  makeAttendantDemo:()=>structuredClone(seed),
  runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:4000});
 const tap=(action,arg='')=>click({target:{closest:()=>({disabled:false,dataset:{action,arg}})}});
 return {tap,html:()=>root.innerHTML};
}
const runToPickup=(h)=>{
 h.tap('demo_prepare_departure');h.tap('start_demo_trip');h.tap('simulate_arrival');
};
const visible=h=>[...h.html().matchAll(/data-pupil="([^"]+)"/g)].map(x=>x[1]);
const marker=(h,kind)=>h.html().includes('data-action="'+kind+'"');
for(const [size,predeclared] of [[5,1],[15,3],[30,6],[50,10]]){
 test('UI165/LOAD/'+size+': bounded queue, each individual boarding, no phantom departure',()=>{
  const h=mounted(makeSeed(size,predeclared));
  runToPickup(h);
  assert.match(h.html(),/role="region" aria-label="Arrêt express/);
  assert.match(h.html(),new RegExp(predeclared+'<\\/strong><span>Absences signalées'));
  const target=size-predeclared;
  assert.equal(visible(h).length,Math.min(target,4));
  assert.equal(marker(h,'bulk_confirm'),false);
  const first=h.html();
  assert.match(first,/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
  assert.match(first,/ÉLÈVES À BORD<\/span><strong>0/);
  for(let i=0;i<target;i++){
   const before=visible(h);
   assert.ok(before.length<=4&&before.length>=1);
   assert.equal(before[0],'S-'+String(i+1).padStart(3,'0'));
   h.tap('board',before[0]);
   assert.equal(visible(h).length,Math.min(4,target-i-1));
   assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
  }
  assert.match(h.html(),/Pointage de cet arrêt terminé/);
  assert.match(h.html(),/Simuler reprise Chauffeur/);
  assert.match(h.html(),/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt/);
  h.tap('simulate_driver_resume');
  assert.match(h.html(),/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
 });
}
test('UI165/SAFETY/01: simulating rapid taps never allows a second arrival at same stop',()=>{
 const h=mounted(makeSeed(5));runToPickup(h);
 const htmlBefore=h.html();
 h.tap('simulate_arrival');
 assert.match(h.html(),/Action refusée/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.ok(htmlBefore.includes('DÉMO · ARRÊT EXPRESS'));
});
test('UI165/SAFETY/02: if none present or guardian missing, never silently mark released',()=>{
 const s=makeSeed(5,5);
 let x=runAttendantDemo(s,'demo_prepare_departure');
 x=runAttendantDemo(x,'start_demo_trip');
 x=runAttendantDemo(x,'simulate_arrival');
 assert.equal(attendantSummary(x).pendingAtStop,0);
 assert.equal(attendantSummary(x).onboard,0);
 assert.equal(x.students.filter(p=>p.alighted).length,0);
 assert.throws(()=>runAttendantDemo(x,'alight',{studentId:'S-001'}),/NOT_ONBOARD/);
});
test('UI165/SAFETY/03: 50 riders must alight at correct final stop one-by-one',()=>{
 const h=mounted(makeSeed(50,0));runToPickup(h);
 for(let i=1;i<=50;i++)h.tap('board','S-'+String(i).padStart(3,'0'));
 assert.match(h.html(),/ÉLÈVES À BORD<\/span><strong>50/);
 h.tap('simulate_driver_resume');
 h.tap('simulate_arrival');
 assert.match(h.html(),/0 à traiter/);
 h.tap('simulate_driver_resume');
 h.tap('simulate_arrival');
 assert.match(h.html(),/Terminus atteint/);
 assert.equal(visible(h).length,4);
 for(let i=1;i<=50;i++){
  const before=visible(h);
  assert.ok(before.length<=4);
  h.tap('alight','S-'+String(i).padStart(3,'0'));
 }
 assert.match(h.html(),/ÉLÈVES À BORD<\/span><strong>0/);
 assert.match(h.html(),/Pointage de cet arrêt terminé/);
 assert.match(h.html(),/Terminus atteint/);
 h.tap('express_close');h.tap('go_closing');h.tap('demo_confirm_empty_and_finish');
 assert.match(h.html(),/TERMINÉE/);
});
test('UI165/SAFETY/04: critical alert prevents Chauffeur resume even after complete boarding',()=>{
 const h=mounted(makeSeed(5));runToPickup(h);
 h.tap('incident','medical');
 for(let i=1;i<=5;i++)h.tap('board','S-'+String(i).padStart(3,'0'));
 assert.match(h.html(),/Alerte ouverte : aucune reprise autorisée/);
 assert.doesNotMatch(h.html(),/data-action="simulate_driver_resume"/);
 assert.match(h.html(),/ALERTE ACTIVE/);
});
test('UI165/SAFETY/05: no skipping initial pickup before first confirmed stop',()=>{
 let s=makeSeed(15);
 s=runAttendantDemo(s,'demo_prepare_departure');
 s=runAttendantDemo(s,'start_demo_trip');
 assert.throws(()=>runAttendantDemo(s,'board',{studentId:'S-001'}),/VEHICLE_NOT_SECURED_AT_STOP/);
});
test('UI165/SAFETY/06: correction of last swipe has full audit trail',()=>{
 let s=makeSeed(5);
 s=runAttendantDemo(s,'demo_prepare_departure');
 s=runAttendantDemo(s,'start_demo_trip');
 s=runAttendantDemo(s,'simulate_arrival');
 s=runAttendantDemo(s,'board',{studentId:'S-001'});
 const before=s.events.length;
 s=runAttendantDemo(s,'undo_last_pointage');
 assert.equal(s.events.length,before+1);
 assert.equal(s.events.at(-1).type,'pointage_reverted');
 assert.equal(s.students[0].boarded,false);
 assert.equal(s.trip.onboardCount,0);
});
test('UI165/SAFETY/07: stop long-name marquee and terminal display remain accessible',()=>{
 assert.match(css,/font-size:clamp\(16px,4vw,20px\)!important/);
 assert.match(css,/@keyframes stop-name-slide/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 const h=mounted(makeSeed(5));runToPickup(h);
 assert.match(h.html(),/stop-name-scroller/);
});
test('UI165/SAFETY/08: isolated application cannot claim operational usability or real server',()=>{
 const h=mounted(makeSeed(5));runToPickup(h);
 assert.match(h.html(),/DÉMO · Sans serveur réel/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
test.todo('UI165/REAL/01: live dual-device authenticated trip and parent changes not tested');
test.todo('UI165/REAL/02: observational test of pointage time, fatigue, screen scrolling and human error not tested');
test.todo('UI165/REAL/03: actual QR/badge identity verification, guardian release and network outage handling not tested');
