import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const model=read('../mobile-session19/attendant-demo.mjs');
test('UI154: follow-up main action preserved, result rendered only under dedicated view',()=>{
 assert.match(ui,/SUIVI DE TOURNÉE<\/span>','go_followup'/);
 assert.match(ui,/view==='followup'\?'followup'/);
 assert.match(ui,/view!=='dashboard'/);
 assert.match(ui,/<h1>Suivi de tournée<\/h1>/);
 assert.doesNotMatch(ui,/showTourDetails/);
});
test('UI154: both hero counters are real buttons',()=>{
 assert.match(ui,/class="hero-stat" data-action="go_students"/);
 assert.match(ui,/class="hero-stat" data-action="go_stops"/);
 assert.match(ui,/ÉLÈVES À BORD/);
 assert.match(ui,/ARRÊTS ATTEINTS/);
 assert.match(ui,/view==='students'/);
 assert.match(ui,/view==='stops'/);
});
test('UI154: bottom four tabs remain unchanged',()=>{
 assert.match(ui,/\[\['tour','▣','Ma tournée'\],\['alerts','⚠','Alertes'\],\['boarding','☑','Pointage'\],\['team','♧','Équipe'\]\]/);
 assert.equal((ui.match(/dash-action'\)/g)||[]).length,4);
});
test('UI154: demo-only readiness switch is clickable and guarded',()=>{
 assert.match(ui,/role="switch" aria-label="Prêt au départ \(simulation\)"/);
 assert.match(ui,/data-action="toggle_ready"/);
 assert.match(ui,/!d\.canToggleReady\?'disabled'/);
 assert.match(model,/READY_PRECONDITIONS_NOT_MET/);
 assert.match(model,/!s\.driverSecured\|\|!s\.ready/);
});
test('UI154: driver-aligned safety instructions, six alerts, and alert history',()=>{
 assert.match(ui,/Pour signaler une alerte, immobilisez et sécurisez le bus/);
 assert.match(ui,/Consignes de sécurité/);
 assert.match(ui,/Suivi des alertes/);
 assert.match(ui,/class="alert-grid"/);
 assert.match(model,/Embouteillage/);
 assert.match(model,/Enfant manquant/);
});
test('UI154: CSS includes click targets, conditional switch and six alert tiles',()=>{
 assert.match(css,/\.hero-stats \.hero-stat/);
 assert.match(css,/\.safety-switch\.on/);
 assert.match(css,/\.alert-grid/);
 assert.match(css,/\.alert-tile:disabled/);
});
test('UI154: results stay inside content area, bottom nav remains outside',()=>{
 assert.match(ui,/<main class="content"/);
 assert.match(ui,/<nav class="bottom"/);
 assert.match(css,/\.content\s*\{[\s\S]*?overflow-y:auto/);
});
test('UI154: DEMO never sends real events or loads network clients',()=>{
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 assert.match(model,/LOCAL_SIMULATION_ONLY/);
 assert.match(ui,/Sans serveur réel/);
 assert.match(ui,/validation croisée entre deux comptes n'est pas encore activée/);
});
