import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const create=()=>{
 let clickHandler;
 const root={innerHTML:'',addEventListener(evt,fn){if(evt==='click')clickHandler=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:2000});
 return {
  html:()=>root.innerHTML,
  click:(action,arg='',tab=false)=>clickHandler({target:{closest:()=>({
   disabled:false,dataset:tab?{tab:action}:{action,arg}
  })}})
 };
};
const startDemo=h=>{
 h.click('go_start');h.click('confirm_presence');h.click('simulate_driver_secure');
 h.click('back_tour');h.click('toggle_ready');
 h.click('go_start');h.click('start_demo_trip');
};
test('UI157: status À PRÉPARER neutral, EN COURS green only after synthetic start',()=>{
 const h=create();
 assert.match(h.html(),/trip-state state-preparing">À PRÉPARER/);
 assert.doesNotMatch(h.html(),/trip-state state-running/);
 startDemo(h);
 assert.match(h.html(),/trip-state state-running">● EN COURS/);
 assert.doesNotMatch(h.html(),/state-preparing/);
 assert.match(css,/\.trip-state\.state-preparing\s*\{\s*border:[^}]*background:#513475/);
 assert.match(css,/\.trip-state\.state-running\s*\{\s*border:[^}]*background:#13835b/);
});
test('UI157: real Wi-Fi symbol replaces placeholder but DEMO never claims server connection',()=>{
 const h=create();
 assert.match(h.html(),/class="network-icon wifi-online"/);
 assert.match(h.html(),/Wi-Fi simulé actif — sans serveur réel/);
 assert.doesNotMatch(h.html(),/title="Réseau fictif">⌁/);
 assert.match(ui,/wifi:'<path/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 h.click('more','',true);h.click('go_sync');h.click('network');h.click('tour','',true);
 assert.match(h.html(),/class="network-icon wifi-offline"/);
 assert.match(h.html(),/Wi-Fi simulé inactif — sans serveur réel/);
});
test('UI157: prochain arrêt has same large warm-yellow Chauffeur-type emphasis',()=>{
 const h=create();
 assert.match(h.html(),/PROCHAIN ARRÊT<\/span><strong>Dépôt<\/strong>/);
 assert.match(css,/\.next-stop strong\s*\{\s*color:#ffe38a!important/);
 assert.match(css,/font-size:clamp\(34px,8\.3vw,54px\)!important/);
 assert.match(css,/\.next-stop \.hero-label/);
});
test('UI157: four driver-labelled primary buttons have same positions and one icon each',()=>{
 const h=create(),page=h.html();
 const labels=['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE'];
 const positions=labels.map(label=>page.indexOf(label));
 assert.ok(positions.every(p=>p>=0)&&positions.every((p,i)=>i===0||p>positions[i-1]));
 assert.equal((page.match(/class="[^"]*dash-action"/g)||[]).length,4);
 assert.match(ui,/icon\('play'\).*DÉMARRER LA COURSE/);
 assert.match(ui,/icon\('refresh'\).*NOUVELLE TOURNÉE/);
 assert.match(ui,/icon\('pin'\).*ARRÊT ATTEINT/);
 assert.match(ui,/icon\('flag'\).*CLÔTURER LA COURSE/);
});
test('UI157: exact bottom navigation and pupils bubble remains single pointage entry',()=>{
 const h=create(),page=h.html();
 assert.match(ui,/\[\['tour','▣','Ma tournée'\],\['alerts','⚠','Alertes'\],\['team','♧','Équipe'\],\['more','•••','Plus'\]\]/);
 assert.match(page,/data-action="go_students"/);
 assert.doesNotMatch(page,/data-tab="boarding"/);
 assert.doesNotMatch(page,/Accès au pointage|Accès à l.itinéraire/);
 h.click('go_students');assert.match(h.html(),/<h1>Élèves à bord<\/h1>/);
});
test('UI157: start tile opens a safe preparation subpage, not real driver privilege',()=>{
 const h=create();
 h.click('go_start');
 assert.match(h.html(),/<h1>Démarrer la course<\/h1>/);
 assert.match(h.html(),/départ réel reste validé par le Chauffeur/);
 assert.match(h.html(),/Étape 1\/3/);
 h.click('start_demo_trip');
 assert.match(h.html(),/Action refusée/);
 assert.match(h.html(),/Départ bloqué/);
});
test('UI157: Arrêt atteint tile opens an explanation, only explicit synthetic arrival updates counter',()=>{
 const h=create();startDemo(h);
 h.click('go_arrival');
 assert.match(h.html(),/<h1>Arrêt atteint<\/h1>/);
 assert.match(h.html(),/Seul le Chauffeur valide une arrivée réelle/);
 assert.match(h.html(),/Simuler arrivée Chauffeur/);
 h.click('simulate_arrival');
 assert.match(h.html(),/Arrêt actif/);
 h.click('back_tour');
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3<\/strong>/);
});
test('UI157: New trip tile cannot erase incomplete trip or silently issue new assignment',()=>{
 const h=create();startDemo(h);
 h.click('go_new_trip');
 assert.match(h.html(),/nouvelle tournée réelle doit être affectée par la supervision/i);
 assert.match(h.html(),/data-action="new_demo_trip"[^>]*disabled/);
 h.click('new_demo_trip');
 assert.match(h.html(),/Action refusée/);
 assert.match(h.html(),/TRIP_NOT_COMPLETED/);
});
test('UI157: Plus contains journal, announcements and demo-only simulated sync',()=>{
 const h=create();h.click('more','',true);
 for(const label of ['Journal des tournées','Annonces vocales','Connexion et synchronisation'])assert.match(h.html(),new RegExp(label));
 h.click('go_journal');assert.match(h.html(),/Suivi de tournée/);
 h.click('more','',true);h.click('go_voice');assert.match(h.html(),/indisponible/);
 h.click('more','',true);h.click('go_sync');
 assert.match(h.html(),/Sans serveur réel/);
 assert.match(h.html(),/Événements transmis<\/span><strong>0/);
});
test('UI157: closures remain safe and role authorization never controls vehicles',()=>{
 const h=create();h.click('go_closing');
 assert.match(h.html(),/Clôture de la tournée/);
 assert.match(h.html(),/Inspection finale du bus/);
 assert.match(h.html(),/data-action="finish_demo_trip"[^>]*disabled/);
 assert.throws(()=>runAttendantDemo(makeAttendantDemo(),'assign_vehicle'),/ACTION_DENIED/);
});
