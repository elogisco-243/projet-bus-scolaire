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
 let handler;
 const root={innerHTML:'',addEventListener(event,fn){if(event==='click')handler=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,attendantSummary,
  attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS
 },{timeout:2000});
 return {html:()=>root.innerHTML,click:(action,arg='')=>handler({target:{closest:()=>({disabled:false,dataset:{action,arg}})}})};
};
const actionTag=(h,action)=>{
 const match=h.html().match(new RegExp('<button[^>]*data-action="'+action+'"[^>]*>'));
 assert.ok(match,'Missing action '+action);return match[0];
};
test('UI159: before preparation, start and arrival are natively disabled',()=>{
 const h=makeUI();
 assert.match(actionTag(h,'start_demo_trip'),/\bdisabled\b/);
 assert.match(actionTag(h,'simulate_arrival'),/\bdisabled\b/);
 assert.match(h.html(),/À PRÉPARER/);
});
test('UI159: readiness immediately enables purple START, not arrival',()=>{
 const h=makeUI();h.click('demo_prepare_departure');
 assert.doesNotMatch(actionTag(h,'start_demo_trip'),/\bdisabled\b/);
 assert.match(actionTag(h,'simulate_arrival'),/\bdisabled\b/);
 assert.match(h.html(),/aria-checked="true"/);
});
test('UI159: starting disables start and enables yellow ARRÊT ATTEINT',()=>{
 const h=makeUI();h.click('demo_prepare_departure');h.click('start_demo_trip');
 assert.match(h.html(),/state-running/);
 assert.match(actionTag(h,'start_demo_trip'),/\bdisabled\b/);
 assert.doesNotMatch(actionTag(h,'simulate_arrival'),/\bdisabled\b/);
});
test('UI159: at stop arrival is disabled, then re-enabled after pupil pointage',()=>{
 const h=makeUI();h.click('demo_prepare_departure');h.click('start_demo_trip');
 h.click('simulate_arrival');
 assert.match(actionTag(h,'simulate_arrival'),/\bdisabled\b/);
 h.click('go_students');h.click('board','E-01');
 assert.doesNotMatch(actionTag(h,'simulate_arrival'),/\bdisabled\b/);
 assert.match(h.html(),/ARRÊTS ATTEINTS<\/span><strong>1\/3/);
});
test('UI159: specific enabled/disabled CSS overrides muted UI157 without changing disabled semantics',()=>{
 const ui159=css.slice(css.indexOf('/* UI-159'));
 assert.ok(ui159.length>100);
 assert.ok(css.indexOf('/* UI-159')>css.indexOf('/* UI-157'));
 for(const action of ['start_demo_trip','simulate_arrival']){
  assert.match(ui159,new RegExp('button\\[data-action="'+action+'"\\]:enabled\\{[\\s\\S]*?background:'));
  assert.match(ui159,new RegExp('button\\[data-action="'+action+'"\\]:disabled\\{[\\s\\S]*?background:'));
 }
 assert.match(ui159,/start_demo_trip"\]:enabled\{[\s\S]*?background:linear-gradient\(125deg,#7936D3,#5815B0\)/);
 assert.match(ui159,/simulate_arrival"\]:enabled\{[\s\S]*?background:#FFD15D/);
 assert.match(ui159,/@media\(forced-colors:active\)/);
 assert.match(ui, /!d\.canStart/);
 assert.match(ui, /!d\.canSimulateArrival/);
});
test('UI159: closing and new-trip tiles maintain distinct guarded states',()=>{
 const h=makeUI();
 assert.match(actionTag(h,'new_demo_trip'),/\bdisabled\b/);
 assert.match(actionTag(h,'go_closing'),/\bdisabled\b/);
 const ui159=css.slice(css.indexOf('/* UI-159'));
 assert.match(ui159,/go_closing"\]:enabled/);
 assert.match(ui159,/new_demo_trip"\]:enabled/);
});
