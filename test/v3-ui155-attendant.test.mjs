import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const build=read('../scripts/build-attendant-testhost.mjs');
const create=()=>{
 let onClick;
 const root={innerHTML:'',addEventListener(name,fn){if(name==='click')onClick=fn;}};
 const globals={document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS};
 const code=ui.replace(/^import .*;\s*$/m,'');
 vm.runInNewContext(code,globals,{timeout:1500});
 return {root,html:()=>root.innerHTML,click:(action,arg='',tab=false)=>{
  onClick({target:{closest:()=>({disabled:false,dataset:tab?{tab:action}:{action,arg}})}});
 }};
};
test('UI155: preserves exact four big action tiles and four navigation tabs',()=>{
 const h=create(),html=h.html();
 assert.equal((html.match(/dash-action/g)||[]).length,4);
 for(const name of ['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE'])assert.match(html,new RegExp(name));
 for(const tab of ['Ma tournée','Alertes','Équipe','Plus'])assert.ok(html.includes(tab));
 assert.match(html,/data-action="go_students"/);
 assert.match(html,/data-action="go_stops"/);
});
test('UI155/UI158: Chauffeur-style readiness and one action to start',()=>{
 const h=create();
 assert.match(h.html(),/aria-checked="false"/);
 h.click('demo_prepare_departure');assert.match(h.html(),/aria-checked="true"/);
 h.click('start_demo_trip');assert.match(h.html(),/trip-state state-running/);
});
test('UI155/UI158: each arrival exposes only the pupils for the active stop',()=>{
 const h=create();
 h.click('demo_prepare_departure');h.click('start_demo_trip');h.click('simulate_arrival');
 h.click('go_students');
 assert.match(h.html(),/data-action="board" data-arg="E-01"/);
 assert.doesNotMatch(h.html(),/data-action="board" data-arg="E-02"/);
 h.click('board','E-01');
 h.click('simulate_arrival');h.click('go_students');
 assert.match(h.html(),/data-action="board" data-arg="E-02"/);
 assert.doesNotMatch(h.html(),/data-action="board" data-arg="E-01"/);
 h.click('mark_absent','E-02');
 h.click('simulate_arrival');h.click('go_students');
 assert.match(h.html(),/data-action="alight" data-arg="E-01"/);
 assert.doesNotMatch(h.html(),/data-action="alight" data-arg="E-02"/);
});
test('UI155/UI157: tracking moved under Plus / journal without an extra main action',()=>{
 const h=create();
 assert.doesNotMatch(h.html(),/<h1>Suivi de tournée<\/h1>/);
 h.click('more','',true);assert.match(h.html(),/Journal des tournées/);
 h.click('go_journal');assert.match(h.html(),/<h1>Suivi de tournée<\/h1>/);
 h.click('back_tour');assert.match(h.html(),/DÉMARRER LA COURSE/);
});
test('UI155: alert grid remains identical six types, critical accessible while moving',()=>{
 const h=create();
 for(const action of ['confirm_presence','simulate_driver_secure','toggle_ready','start_demo_trip'])h.click(action);
 h.click('go_alerts');
 assert.deepEqual(INCIDENTS.map(x=>x[0]),['Embouteillage','Retard','Panne','Accident','Urgence médicale','Enfant manquant']);
 const urgent=h.html().match(/<button[^>]*data-action="incident" data-arg="medical"[^>]*>/);
 const ordinary=h.html().match(/<button[^>]*data-action="incident" data-arg="delay"[^>]*>/);
 assert.ok(urgent&&ordinary);
 assert.doesNotMatch(urgent[0],/disabled/);
 assert.match(ordinary[0],/disabled/);
 h.click('incident','medical');assert.match(h.html(),/Ouverte · démo locale/);
});
test('UI155/UI158: final inspection remains mandatory despite direct navigation',()=>{
 const h=create();
 h.click('demo_prepare_departure');h.click('start_demo_trip');h.click('simulate_arrival');
 h.click('go_students');h.click('board','E-01');
 h.click('simulate_arrival');h.click('go_students');h.click('mark_absent','E-02');
 h.click('simulate_arrival');h.click('go_students');h.click('alight','E-01');
 h.click('go_closing');
 assert.match(h.html(),/Inspection finale du bus/);
 assert.match(h.html(),/Je confirme le bus vide et clôture \(démo\)/);
 h.click('demo_confirm_empty_and_finish');
 assert.match(h.html(),/TERMINÉE/);
});
test('UI155: style is responsive, demo alone and network-disabled',()=>{
 assert.match(css,/\.workflow-strip/);
 assert.match(css,/\.closing-check/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/\.content\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(build,/LOCAL_SIMULATION_ONLY/);
 assert.match(build,/connect-src \'none\'/);
 assert.match(build,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
});
