import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const ui=readFileSync(fileURLToPath(new URL('../mobile-session19/app.mjs',import.meta.url)),'utf8');
const css=readFileSync(fileURLToPath(new URL('../mobile-session19/style.css',import.meta.url)),'utf8');
const create=()=>{
 let clickHandler;
 const root={innerHTML:'',addEventListener(event,fn){if(event==='click')clickHandler=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,attendantSummary,
  attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:3000});
 return {
  html:()=>root.innerHTML,
  click:(action,arg='')=>clickHandler({target:{closest:()=>({disabled:false,dataset:{action,arg}})}}),
  tab:id=>clickHandler({target:{closest:()=>({disabled:false,dataset:{tab:id}})}})
 };
};
const begin=h=>{h.click('demo_prepare_departure');h.click('start_demo_trip');};
test('UI161/01: planned screen keeps next stop and readiness switch',()=>{
 const h=create(),page=h.html();
 assert.match(page,/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller">Dépôt/);
 assert.match(page,/data-action="demo_prepare_departure"/);
 assert.doesNotMatch(page,/data-action="go_students"[^>]*pointage-direct/);
});
test('UI161/02: after first arrival large label means ACTUAL depot, not next unvisited stop',()=>{
 const h=create();begin(h);h.click('simulate_arrival');
 const page=h.html();
 assert.match(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt/);
 assert.doesNotMatch(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.match(page,/ÉLÈVES À BORD<\/span><strong>0/);
});
test('UI161/03: Arrêt atteint remains clickable and opens pointage, never duplicates arrival',()=>{
 const h=create();begin(h);h.click('simulate_arrival');
 let page=h.html();
 assert.match(page,/class="warn dash-action pointage-direct" data-action="go_students"/);
 assert.match(page,/Arrêt atteint — ouvrir le pointage des élèves/);
 h.click('go_students');
 page=h.html();
 assert.match(page,/Arrêt express/);
 assert.match(page,/data-action="board" data-arg="E-01"/);
 h.click('back_tour');
 page=h.html();
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
 assert.match(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt/);
});
test('UI161/UI163: after pointage, driver resume is explicit and next stop appears afterwards',()=>{
 const h=create();begin(h);h.click('simulate_arrival');h.click('go_students');h.click('board','E-01');
 let page=h.html();
 assert.match(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt/);
 assert.match(page,/Simuler reprise Chauffeur/);
 h.click('simulate_driver_resume');page=h.html();
 assert.match(page,/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
 assert.match(page,/Trajet en cours \(démo\)/);
 assert.doesNotMatch(page,/pointage-direct/);
 assert.match(page,/data-action="simulate_arrival"/);
 h.click('simulate_arrival');page=h.html();
 assert.match(page,/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Arrêt fictif A/);
 assert.match(page,/ARRÊTS ATTEINTS<\/span><strong>2\/3/);
});
test('UI161/05: readiness switch disappears after departure and status becomes contextual',()=>{
 const h=create();begin(h);
 assert.doesNotMatch(h.html(),/data-action="demo_prepare_departure"/);
 assert.match(h.html(),/Trajet en cours \(démo\)/);
 h.click('simulate_arrival');
 assert.doesNotMatch(h.html(),/data-action="demo_prepare_departure"/);
 assert.match(h.html(),/Arrêt enregistré · Sécurisation simulée/);
 assert.match(h.html(),/Pointage à effectuer : 1 élève/);
});
test('UI161/06: four main button labels and four tabs remain unchanged',()=>{
 const h=create();begin(h);h.click('simulate_arrival');const page=h.html();
 for(const title of ['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE','Ma tournée','Alertes','Équipe','Plus'])assert.match(page,new RegExp(title));
 assert.equal((page.match(/class="[^"]*dash-action(?: [^"]*)?"/g)||[]).length,4);
 assert.match(css,/\.dash-action\.pointage-direct:not\(:disabled\)/);
 assert.match(css,/\.safety-row \.safety-status-mark/);
});
test('UI161/07: no pretend real driver validation or operational connection introduced',()=>{
 const h=create();begin(h);h.click('simulate_arrival');
 assert.match(h.html(),/DÉMO · Sans serveur réel/);
 assert.match(h.html(),/Sécurisation simulée/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
