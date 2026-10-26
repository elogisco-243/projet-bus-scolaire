import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const makeUI=()=>{
 let clickHandler;
 const root={innerHTML:'',addEventListener(evt,handler){if(evt==='click')clickHandler=handler;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:2000});
 return {html:()=>root.innerHTML,click:(action,arg='',isTab=false)=>clickHandler({target:{
  closest:()=>({disabled:false,dataset:isTab?{tab:action}:{action,arg}})
 }})};
};
const start=h=>{
 h.click('demo_prepare_departure');
 h.click('start_demo_trip');
};
const arrive=h=>h.click('simulate_arrival');

test('UI158: direct Chauffeur-like readiness switch, then start; no intermediary wizard',()=>{
 const h=makeUI();let page=h.html();
 assert.match(page,/trip-state state-preparing">À PRÉPARER/);
 assert.match(page,/data-action="demo_prepare_departure"/);
 assert.match(page,/data-action="start_demo_trip"[^>]*disabled/);
 assert.doesNotMatch(page,/Étape 1\/3|Simuler validation Chauffeur|Activer Prêt au départ \(démo\)/);
 h.click('demo_prepare_departure');
 page=h.html();assert.match(page,/aria-checked="true"/);
 assert.match(page,/data-action="start_demo_trip"/);
 assert.doesNotMatch(page,/data-action="start_demo_trip"[^>]*disabled/);
 h.click('start_demo_trip');assert.match(h.html(),/trip-state state-running">● EN COURS/);
});
test('UI158: one Arrêt atteint tap records only DEMO arrival, keeps attention on dashboard',()=>{
 const h=makeUI();start(h);arrive(h);
 const page=h.html();
 assert.match(page,/data-action="go_students"/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.match(page,/hero-stat indicator-pending indicator-pulse/);
 assert.match(page,/hero-stat indicator-new-stop/);
 assert.doesNotMatch(page,/<h1>Arrêt atteint<\/h1>/);
});
test('UI158: Élèves à bord opens relevant pointage, then returns to home automatically',()=>{
 const h=makeUI();start(h);arrive(h);h.click('go_students');
 assert.match(h.html(),/data-action="board" data-arg="E-01"/);
 assert.doesNotMatch(h.html(),/data-action="board" data-arg="E-02"/);
 h.click('board','E-01');
 assert.match(h.html(),/DÉMARRER LA COURSE/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.match(h.html(),/ÉLÈVES À BORD<\/span><strong>1<\/strong>/);
 assert.doesNotMatch(h.html(),/indicator-pending/);
});
test('UI158/UI163: one confirmed driver resume at each intermediate stop before closure',()=>{
 const h=makeUI();start(h);arrive(h);h.click('go_students');h.click('board','E-01');
 h.click('simulate_driver_resume');arrive(h);h.click('go_students');h.click('mark_absent','E-02');
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>2\/3/);
 h.click('simulate_driver_resume');arrive(h);h.click('go_students');h.click('alight','E-01');
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>3\/3/);
 assert.match(h.html(),/ÉLÈVES À BORD<\/span><strong>0<\/strong>/);
 assert.doesNotMatch(h.html(),/data-action="go_closing"[^>]*disabled/);
 h.click('go_closing');
 assert.match(h.html(),/Je confirme le bus vide et clôture \(démo\)/);
 h.click('demo_confirm_empty_and_finish');
 assert.match(h.html(),/✓ TERMINÉE/);
 assert.match(h.html(),/data-action="new_demo_trip"/);
});
test('UI158: closure never bypasses inspection, open incidents or missing students',()=>{
 let s=makeAttendantDemo();
 assert.throws(()=>runAttendantDemo(s,'demo_confirm_empty_and_finish'),/TRIP_NOT_ACTIVE/);
 s=runAttendantDemo(s,'demo_prepare_departure');
 s=runAttendantDemo(s,'start_demo_trip');
 s=runAttendantDemo(s,'simulate_arrival');
 assert.throws(()=>runAttendantDemo(s,'demo_confirm_empty_and_finish'),/ROUTE_NOT_COMPLETED/);
 const h=makeUI();start(h);
 assert.match(h.html(),/data-action="go_closing"[^>]*disabled/);
 assert.doesNotMatch(h.html(),/✓ TERMINÉE/);
});
test('UI158: active critical incident prevents auto-resume even when pupil is pointed',()=>{
 const h=makeUI();start(h);arrive(h);
 h.click('incident','medical');
 h.click('go_students');h.click('board','E-01');
 // Alert remains open; trip cannot silently move to next stop.
 assert.match(h.html(),/ALERTE ACTIVE/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 h.click('simulate_arrival');
 assert.match(h.html(),/Action refusée/);
});
test('UI158: toggling readiness off before start does not start the course',()=>{
 const h=makeUI();
 h.click('demo_prepare_departure');h.click('demo_prepare_departure');
 assert.match(h.html(),/aria-checked="false"/);
 h.click('start_demo_trip');
 assert.match(h.html(),/Action refusée/);
 assert.match(h.html(),/À PRÉPARER/);
});
test('UI158: demo remains isolated and same four tiles and four tabs are present',()=>{
 const h=makeUI(),page=h.html();
 for(const label of ['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE','Ma tournée','Alertes','Équipe','Plus'])assert.match(page,new RegExp(label));
 assert.equal((page.match(/dash-action/g)||[]).length,4);
 assert.doesNotMatch(page,/data-tab="boarding"/);
 assert.match(css,/\.bottom\{\s*flex:0 0 auto;position:relative/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
