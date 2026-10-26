import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createDemoHub} from '../mobile-session21/demo-hub.mjs';

const source=readFileSync(fileURLToPath(new URL('../mobile-session21/demo-ui.mjs',import.meta.url)),'utf8');
const css=readFileSync(fileURLToPath(new URL('../mobile-session21/demo-ui.css',import.meta.url)),'utf8');
const wait=async(fn,timeout=3500)=>{
 const until=Date.now()+timeout;
 while(Date.now()<until){if(fn())return;await new Promise(resolve=>setTimeout(resolve,25));}
 assert.fail('Timed out waiting for browser test state');
};
async function harness(t){
 const server=createDemoHub().listen({port:0});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const listeners={};
 const root={innerHTML:'',addEventListener(type,callback){listeners[type]=callback;},
  insertAdjacentHTML(_where,html){this.innerHTML=html+this.innerHTML;}};
 const window={location:{search:'?profile=accompagnateur'},scrollY:0,scrollTo(){}};
 const context=vm.createContext({document:{getElementById:()=>root},window,URLSearchParams,
  fetch:(path,opts)=>globalThis.fetch(base+path,opts),
  crypto:{randomUUID},setInterval:()=>1,clearInterval:()=>{},console});
 vm.runInContext(source,context,{filename:'demo-ui.mjs'});
 await wait(()=>root.innerHTML.includes('Session Accompagnateur'));
 const join=async profile=>{
  const response=await globalThis.fetch(base+'/api/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile})});
  assert.equal(response.status,200);return (await response.json()).token;
 };
 const state=async token=>{
  const response=await globalThis.fetch(base+'/api/state',{headers:{authorization:'Bearer '+token}});
  assert.equal(response.status,200);return (await response.json()).snapshot;
 };
 const submit=async(token,type,payload={})=>{
  const before=await state(token);
  const response=await globalThis.fetch(base+'/api/action',{method:'POST',
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({type,payload,expectedRevision:before.revision,commandId:'TEST-'+randomUUID()})});
  assert.equal(response.status,200,JSON.stringify(await response.json()));
 };
 return {root,listeners,context,join,state,submit};
}
function clickButton(listeners,type,payload={}){
 const target={disabled:false,dataset:{type,payload:JSON.stringify(payload)}};
 listeners.click({target:{closest:()=>target}});
}
test('UI169/MOB01: Attendant ready button is the FIRST actionable section before KPI grid and works',async t=>{
 const h=await harness(t);
 const html=h.root.innerHTML;
 const action=html.indexOf('data-type="ready"');
 const metrics=html.indexOf('class="metric-grid"');
 assert.ok(action>0,'Ready button must be present at planned state');
 assert.ok(action<metrics,'Ready button must be BEFORE the KPI grid');
 assert.match(html,/Action principale Accompagnateur/);
 assert.match(html,/<button[^>]*data-type="ready"[^>]*>Confirmer la préparation/);
 assert.doesNotMatch(html.match(/<button[^>]*data-type="ready"[^>]*>/)?.[0]||'',/disabled/);
 clickButton(h.listeners,'ready');
 await wait(()=>h.root.innerHTML.includes('Préparation confirmée'));
 assert.equal((await h.state(await h.join('accompagnateur'))).attendantReady,true);
 assert.ok(h.root.innerHTML.indexOf('Préparation confirmée')<h.root.innerHTML.indexOf('class="metric-grid"'));
 assert.ok(!h.root.innerHTML.includes('data-type="ready"'),'No stale disabled Ready button remains in action panel');
});
test('UI169/MOB02: after crew arrival, phone shows pointage instructions and then active departure clearance',async t=>{
 const h=await harness(t);
 const driver=await h.join('chauffeur');
 clickButton(h.listeners,'ready');
 await wait(()=>h.root.innerHTML.includes('Préparation confirmée'));
 await h.submit(driver,'start');
 await h.submit(driver,'arrive',{stopId:'STOP-01'});
 await vm.runInContext('refresh()',h.context);
 await wait(()=>h.root.innerHTML.includes('Pointage à terminer'));
 assert.ok(h.root.innerHTML.indexOf('Pointage à terminer')<h.root.innerHTML.indexOf('class="metric-grid"'));
 assert.match(h.root.innerHTML,/data-type="board"/);
 clickButton(h.listeners,'board',{studentId:'E-01'});
 await wait(()=>h.root.innerHTML.includes('data-type="clear_stop"'));
 assert.ok(h.root.innerHTML.indexOf('data-type="clear_stop"')<h.root.innerHTML.indexOf('class="metric-grid"'));
 const topButton=h.root.innerHTML.match(/<button[^>]*data-type="clear_stop"[^>]*>/)?.[0]||'';
 assert.doesNotMatch(topButton,/disabled/);
 clickButton(h.listeners,'clear_stop');
 await wait(()=>h.root.innerHTML.includes('Feu vert transmis'));
 assert.equal((await h.state(driver)).stopClearance,true);
});
test('UI169/MOB03: mobile layout prioritizes visible touch action, with no fabricated operational authorization',()=>{
 assert.match(css,/\.primary-panel \.primary-action\{[^}]*min-height:56px/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/\.session-intro\{display:none\}/);
 assert.match(source,/Simulation partagée/);
 assert.match(source,/Identités non authentifiées/);
});
