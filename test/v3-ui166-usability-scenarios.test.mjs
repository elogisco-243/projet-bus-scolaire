import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,
 INCIDENTS,CRITICAL_INCIDENTS,makeUsabilityFixture,USABILITY_SIZES
} from '../mobile-session19/attendant-demo.mjs';

const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const style=read('../mobile-session19/style.css');
const builder=read('../scripts/build-attendant-testhost.mjs');
function create(){
 let onClick, now=1000;
 const root={innerHTML:'',addEventListener(name,fn){if(name==='click')onClick=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},
  makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,
  INCIDENTS,CRITICAL_INCIDENTS,makeUsabilityFixture,USABILITY_SIZES,
  Date:{now:()=>{now+=1000;return now;}}
 },{timeout:3000});
 return {
  html:()=>root.innerHTML,
  tap:(action,arg='')=>onClick({target:{closest:()=>({disabled:false,dataset:{action,arg}})}}),
  tab:id=>onClick({target:{closest:()=>({disabled:false,dataset:{tab:id}})}})
 };
}
function load(h,n){
 h.tab('more');
 h.tap('go_usability');
 assert.match(h.html(),/Essais de maniabilité · Démo/);
 h.tap('load_usability',String(n));
}
const nextStudent=page=>{
 const r=page.match(/data-pupil="([^"]+)"[\s\S]*?<button[^>]*data-action="(alight|board)" data-arg="([^"]+)"/);
 assert.ok(r,'Missing first available student button');
 assert.equal(r[1],r[3],'Button and selected pupil must match');
 return {id:r[1],action:r[2]};
};
test('UI166/01: only valid trial sizes and DEMO source are allowed',()=>{
 assert.deepEqual(USABILITY_SIZES,[5,15,30,50]);
 for(const n of [0,4,6,16,29,31,51,50.1,NaN,'50'])assert.throws(()=>makeUsabilityFixture(n),/INVALID_DEMO_LOAD_SIZE/);
 const s=makeUsabilityFixture(5);
 assert.equal(s.mode,'demo');assert.equal(s.session.mode,'demo');assert.equal(s.trip.status,'in_progress');
 assert.equal(s.activeStopId,'STOP-02');assert.equal(s.stops[0].reached,true);
 assert.equal(s.stops[1].reached,true);assert.equal(s.stops[2].reached,false);
 assert.equal(s.events[0].delivery,'LOCAL_SIMULATION_ONLY');
 assert.equal(s.usabilityFixture.realDriverApproval,false);
});
for(const n of USABILITY_SIZES){
 test('UI166/LOAD/'+n+': mixed boarding/alighting and predeclared absence, bounded first screen',()=>{
  const h=create();load(h,n);
  const desc=Math.floor(n/3),abs=Math.floor(n/5),boarding=n-desc-abs;
  const page=h.html();
  assert.match(page,/DÉMO · ARRÊT EXPRESS/);
  assert.match(page,/Arrêt fictif A/);
  assert.match(page,new RegExp(desc+'<\\/strong><span>Descentes restantes'));
  assert.match(page,new RegExp(boarding+'<\\/strong><span>Montées restantes'));
  assert.match(page,new RegExp(abs+'<\\/strong><span>Absences signalées'));
  assert.match(page,new RegExp((n-abs)+' à traiter'));
  assert.match(page,/Descente attendue/);
  assert.equal((page.match(/data-pupil="TEST-/g)||[]).length,Math.min(4,n-abs));
  assert.doesNotMatch(page,/data-pupil="E-01"/);
  assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>2\/3/);
 });
 test('UI166/COMPLETE/'+n+': one physical gesture per pupil, no auto driver resume',()=>{
  const h=create();load(h,n);
  const total=n-Math.floor(n/5);
  for(let k=0;k<total;k++){
   const item=nextStudent(h.html());
   h.tap(item.action,item.id);
   assert.equal((h.html().match(/data-pupil="TEST-/g)||[]).length,Math.min(4,total-k-1));
  }
  assert.match(h.html(),/Pointage de cet arrêt terminé/);
  assert.match(h.html(),/Simuler reprise Chauffeur/);
  assert.match(h.html(),/Essai UX/);
  assert.match(h.html(),new RegExp((total-1)+' s entre le premier et le dernier pointage'));
  assert.match(h.html(),/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
  h.tap('simulate_driver_resume');
  assert.match(h.html(),/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller">Arrêt fictif B/);
 });
}
test('UI166/02: no fixture load button on the four-tile dashboard',()=>{
 const h=create(),before=h.html();
 assert.equal((before.match(/dash-action/g)||[]).length,4);
 assert.doesNotMatch(before,/load_usability|Essais de maniabilité/);
 h.tab('more');
 assert.match(h.html(),/Essais de maniabilité \(Démo\)/);
 h.tap('go_usability');
 for(const n of USABILITY_SIZES)assert.match(h.html(),new RegExp('data-action="load_usability" data-arg="'+n+'"'));
});
test('UI166/03: undo updates metrics and is audited; retry is still individually confirmed',()=>{
 const h=create();load(h,5);
 let first=nextStudent(h.html());h.tap(first.action,first.id);
 assert.match(h.html(),/3 à traiter/);
 h.tap('undo_last_pointage');
 assert.match(h.html(),/4 à traiter/);
 h.tab('more');h.tap('go_usability');
 assert.match(h.html(),/1 correction\(s\)/);
 assert.match(h.html(),/3 geste\(s\)|2 geste\(s\)/);
});
test('UI166/04: rejection of malformed trial input leaves DEMO unchanged',()=>{
 const h=create();h.tab('more');h.tap('go_usability');h.tap('load_usability','51');
 assert.match(h.html(),/Action refusée/);
 assert.doesNotMatch(h.html(),/DÉMO · ARRÊT EXPRESS/);
});
test('UI166/05: original reset behavior and user session remain DEMO',()=>{
 const h=create();load(h,30);
 h.tab('team');h.tap('reset');
 assert.match(h.html(),/DÉMARRER LA COURSE/);
 assert.doesNotMatch(h.html(),/TEST-001/);
 assert.match(h.html(),/DÉMO · Sans serveur réel/);
});
test('UI166/06: no network or real roles added to test fixture or Android bundle',()=>{
 assert.match(builder,/usability-fixtures\.mjs/);
 assert.match(style,/\.ux-trial-load/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
test.todo('UI166/HUMAN: real stop dwell time, observed user errors, training cost and physical supervision are not measured by app gestures');
test.todo('UI166/OPS: two-device verified identities, Parent authorizations and guardian badge handover remain unavailable');
