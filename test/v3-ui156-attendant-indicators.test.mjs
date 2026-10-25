import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,
 INCIDENTS,CRITICAL_INCIDENTS
} from '../mobile-session19/attendant-demo.mjs';

const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const build=read('../scripts/build-attendant-testhost.mjs');
const makeUI=()=>{
 let handler;
 const root={innerHTML:'',addEventListener(event,callback){
  if(event==='click')handler=callback;
 }};
 const source=ui.replace(/^import .*;\s*$/m,'');
 vm.runInNewContext(source,{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:2000});
 return {
  html:()=>root.innerHTML,
  click:(action,arg='',isTab=false)=>{
   handler({target:{closest:()=>({
    disabled:false,dataset:isTab?{tab:action}:{action,arg}
   })}});
  }
 };
};
const start=h=>{
 for(const action of ['confirm_presence','simulate_driver_secure','toggle_ready','start_demo_trip'])h.click(action);
};
const arrive=h=>h.click('simulate_arrival');

test('UI156: both bubbles have driver-size labels, numbers, arrows and no subtext',()=>{
 const h=makeUI(),page=h.html();
 assert.match(page,/data-action="go_students"/);
 assert.match(page,/data-action="go_stops"/);
 assert.match(page,/ÉLÈVES À BORD<\/span><strong>0<\/strong>/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>0\/3<\/strong>/);
 assert.doesNotMatch(page,/Accès au pointage|Accès à l.itinéraire/);
 assert.doesNotMatch(page,/indicator-pending|indicator-pulse|indicator-new-stop/);
});
test('UI156: new active stop highlights both indicators, and only pending pupils stay highlighted',()=>{
 const h=makeUI();start(h);arrive(h);h.click('back_tour');
 let page=h.html();
 assert.match(page,/hero-stat indicator-pending indicator-pulse/);
 assert.match(page,/hero-stat indicator-new-stop/);
 assert.match(page,/1 pointage\(s\) attendu\(s\)/);
 h.click('go_stops');h.click('back_tour');
 page=h.html();
 assert.match(page,/hero-stat indicator-pending/);
 assert.doesNotMatch(page,/indicator-pulse|indicator-new-stop/);
});
test('UI156: the pupil bubble leads directly to active-stop pointage in one navigation',()=>{
 const h=makeUI();start(h);arrive(h);h.click('back_tour');
 h.click('go_students');
 const page=h.html();
 assert.match(page,/<h1>Élèves à bord<\/h1>/);
 assert.match(page,/Arrêt actif/);
 assert.match(page,/data-action="board" data-arg="E-01"/);
 assert.match(page,/data-action="mark_absent" data-arg="E-01"/);
 assert.doesNotMatch(page,/data-action="board" data-arg="E-02"/);
 assert.doesNotMatch(page,/Ouvrir Pointage/);
});
test('UI156: completing pointage removes student highlight, without changing stop count',()=>{
 const h=makeUI();start(h);arrive(h);h.click('back_tour');
 h.click('go_students');h.click('board','E-01');
 h.click('back_tour');
 const page=h.html();
 assert.doesNotMatch(page,/indicator-pending|indicator-pulse|indicator-new-stop/);
 assert.match(page,/ÉLÈVES À BORD<\/span><strong>1<\/strong>/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>1\/3<\/strong>/);
});
test('UI156: a later confirmed stop produces a new pulse and the next assigned pupil only',()=>{
 const h=makeUI();start(h);arrive(h);
 h.click('board','E-01');h.click('simulate_driver_resume');arrive(h);h.click('back_tour');
 assert.match(h.html(),/hero-stat indicator-pending indicator-pulse/);
 assert.match(h.html(),/hero-stat indicator-new-stop/);
 h.click('go_students');
 const page=h.html();
 assert.match(page,/data-action="board" data-arg="E-02"/);
 assert.doesNotMatch(page,/data-action="board" data-arg="E-01"/);
});
test('UI156: after last student action indicators become steady again, route bubble navigates',()=>{
 const h=makeUI();start(h);arrive(h);h.click('board','E-01');
 h.click('simulate_driver_resume');arrive(h);h.click('mark_absent','E-02');
 h.click('simulate_driver_resume');arrive(h);h.click('back_tour');
 assert.match(h.html(),/indicator-pending/);
 h.click('go_students');h.click('alight','E-01');h.click('back_tour');
 assert.doesNotMatch(h.html(),/indicator-pending|indicator-pulse|indicator-new-stop/);
 h.click('go_stops');assert.match(h.html(),/Itinéraire et arrêts/);
 assert.match(h.html(),/3\. Arrêt fictif B/);
});
test('UI156: resetting demo also resets attention state, no fictitious notification sent',()=>{
 const h=makeUI();start(h);arrive(h);h.click('back_tour');
 assert.match(h.html(),/indicator-pending/);
 h.click('reset');
 assert.doesNotMatch(h.html(),/indicator-pending|indicator-pulse|indicator-new-stop/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>0\/3/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 assert.match(build,/connect-src 'none'/);
});
test('UI156: two animation cycles max, fixed dot, reduced motion and no layout shifts',()=>{
 assert.match(css,/\.hero-stat\.indicator-pending::after/);
 assert.match(css,/\.hero-stat\.indicator-pulse/);
 assert.match(css,/\.hero-stat\.indicator-new-stop/);
 assert.match(css,/animation:ui156-student-attention 750ms ease-in-out 2/);
 assert.match(css,/animation:ui156-stop-arrival 700ms ease-in-out 2/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.doesNotMatch(css.slice(css.indexOf('/* UI-156:')),/infinite|display:none|height:\s*auto/);
});
