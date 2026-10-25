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
test('UI155: all preparation steps available from Ma tournée without switching tab',()=>{
 const h=create();
 h.click('go_start');
 assert.match(h.html(),/Étape 1\/3/);
 h.click('confirm_presence');assert.match(h.html(),/Simuler validation Chauffeur/);
 h.click('simulate_driver_secure');assert.match(h.html(),/Activez le switch/);
 h.click('back_tour');h.click('toggle_ready');assert.match(h.html(),/aria-checked="true"/);
 h.click('go_start');
 h.click('start_demo_trip');assert.match(h.html(),/Simuler arrivée à l’arrêt/);
});
test('UI155: one arrival opens stop-specific pointage and the right pupils',()=>{
 const h=create();
 for(const action of ['confirm_presence','simulate_driver_secure','toggle_ready','start_demo_trip','simulate_arrival'])h.click(action);
 assert.match(h.html(),/Arrêt actif/);
 assert.match(h.html(),/data-action="board" data-arg="E-01"/);assert.doesNotMatch(h.html(),/data-action="board" data-arg="E-02"/);
 h.click('board','E-01');
 assert.match(h.html(),/Reprendre la tournée/);
 h.click('simulate_driver_resume');h.click('simulate_arrival');
 assert.match(h.html(),/data-action="board" data-arg="E-02"/);assert.doesNotMatch(h.html(),/data-action="board" data-arg="E-01"/);
 h.click('mark_absent','E-02');h.click('simulate_driver_resume');h.click('simulate_arrival');
 assert.match(h.html(),/data-action="alight" data-arg="E-01"/);assert.doesNotMatch(h.html(),/data-action="alight" data-arg="E-02"/);
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
test('UI155: guided closure prevents skipping the final inspection',()=>{
 const h=create();
 for(const action of ['confirm_presence','simulate_driver_secure','toggle_ready','start_demo_trip','simulate_arrival'])h.click(action);
 h.click('board','E-01');h.click('simulate_driver_resume');h.click('simulate_arrival');
 h.click('mark_absent','E-02');h.click('simulate_driver_resume');h.click('simulate_arrival');
 h.click('alight','E-01');h.click('go_closing');
 assert.match(h.html(),/Clôture de la tournée/);
 assert.match(h.html(),/Inspection finale du bus/);
 assert.match(h.html(),/Clôturer la tournée \(démo\)/);
 h.click('confirm_empty');h.click('finish_demo_trip');
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
