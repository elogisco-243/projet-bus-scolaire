import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=(p)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const build=read('../scripts/build-attendant-testhost.mjs');
test('UI153: navigation Accompagnateur has Chauffeur format with approved order',()=>{
 const match=ui.match(/\[\['tour','▣','Ma tournée'\],\['alerts','⚠','Alertes'\],\['boarding','☑','Pointage'\],\['team','♧','Équipe'\]\]/);
 assert.ok(match,'Navigation must have exactly four menu entries in approved order');
});
test('UI153: dashboard mirrors photographed Driver v1.7 composition',()=>{
 for(const c of ['tour-hero','tour-heading','next-stop','hero-stats','hero-info','dashboard-actions','bottom']){
  assert.ok(ui.includes(c),c+' must be present in dashboard');
 }
 assert.equal((ui.match(/dash-action'\)/g)||[]).length,4,'exactly four primary tiles');
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('UI153: viewport sections do not overlay navigation',()=>{
 assert.match(css,/\.app\s*\{[\s\S]*?display:flex;flex-direction:column/);
 assert.match(css,/\.content\s*\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.bottom\s*\{[\s\S]*?position:relative/);
 assert.doesNotMatch(css,/\.bottom\s*\{[^}]*position:fixed/);
});
test('UI153: test host is isolated local demo, not an operational app',()=>{
 assert.match(build,/LOCAL_SIMULATION_ONLY/);
 assert.match(build,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.match(build,/connect-src \\'none\\'/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 assert.match(ui,/validation croisée entre deux comptes n\\?'est pas encore activée/);
});
