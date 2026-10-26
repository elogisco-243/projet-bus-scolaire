import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
function makeUI({width=170,natural=220}={}){
 let clickHandler,onResize,last;
 const root={
  innerHTML:'',
  addEventListener(event,handler){if(event==='click')clickHandler=handler;},
  querySelector(selector){
   assert.equal(selector,'.next-stop-info .stop-name-scroller');
   const match=this.innerHTML.match(/<strong class="(stop-name-scroller[^"]*)">([^<]*)<\/strong>/);
   if(!match)return null;
   const classes=new Set(match[1].split(/\s+/));
   const style=new Map();
   last={text:match[2],classes,properties:style,scrollWidth:natural,parentElement:{clientWidth:width},
    classList:{contains:name=>classes.has(name),toggle(name,val){if(val)classes.add(name);else classes.delete(name);}},
    style:{setProperty:(name,value)=>style.set(name,value)}
   };
   return last;
  }
 };
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{
  document:{querySelector:()=>root},makeAttendantDemo,runAttendantDemo,
  attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS,
  requestAnimationFrame:callback=>callback(),
  window:{addEventListener:(ev,fn)=>{if(ev==='resize')onResize=fn;}}
 },{timeout:3000});
 return {
  html:()=>root.innerHTML,
  click:(action,arg='')=>clickHandler({target:{closest:()=>({disabled:false,dataset:{action,arg}})}}),
  text:()=>last?.text,
  style:()=>last?.properties,
  classes:()=>last?.classes,
  resized:(nextW,nextNatural=natural)=>{width=nextW;natural=nextNatural;onResize();}
 };
}
function goTerminus(h){
 h.click('demo_prepare_departure');h.click('start_demo_trip');
 h.click('simulate_arrival');h.click('board','E-01');h.click('simulate_driver_resume');
 h.click('simulate_arrival');h.click('mark_absent','E-02');h.click('simulate_driver_resume');
 h.click('simulate_arrival');
}
test('UI164/01: title format matches original Chauffeur APK UI-132 precisely on phone',()=>{
 const mobile=css.slice(css.lastIndexOf('/* UI-164'));
 assert.match(mobile,/font-size:clamp\(16px,4vw,20px\)!important/);
 assert.match(mobile,/color:#ffe48a!important/);
 assert.match(mobile,/font-weight:800!important/);
 assert.match(mobile,/line-height:1\.2!important/);
});
test('UI164/02: original clipping prevented ticker, now parent clips and text moves',()=>{
 const mobile=css.slice(css.lastIndexOf('/* UI-164'));
 assert.match(mobile,/\.next-stop \.next-stop-info\s*\{[^}]*overflow:hidden/);
 assert.match(mobile,/\.stop-name-scroller\s*\{[^}]*width:max-content!important/);
 assert.match(mobile,/white-space:nowrap!important/);
 assert.match(mobile,/overflow:visible!important/);
 assert.match(mobile,/@keyframes stop-name-slide/);
 assert.match(mobile,/prefers-reduced-motion:reduce/);
});
test('UI164/03: in-progress first stop still says ARRÊT ACTUEL not Terminus',()=>{
 const h=makeUI();h.click('demo_prepare_departure');h.click('start_demo_trip');h.click('simulate_arrival');
 assert.match(h.html(),/ARRÊT ACTUEL<\/span><strong class="stop-name-scroller">Dépôt<\/strong>/);
});
test('UI164/04: terminal arrival displays exact Terminus atteint with original PROCHAIN ARRÊT heading',()=>{
 const h=makeUI();goTerminus(h);
 assert.match(h.html(),/PROCHAIN ARRÊT<\/span><strong class="stop-name-scroller terminus-reached">Terminus atteint<\/strong>/);
 assert.match(h.html(),/TERMINUS ATTEINT · Bus déclaré immobilisé/);
 assert.equal(h.text(),'Terminus atteint');
 assert.ok(h.classes().has('stop-name-overflow'));
});
test('UI164/05: terminal banner persists when pointage is finished and on trip closure',()=>{
 const h=makeUI();goTerminus(h);
 h.click('alight','E-01');h.click('express_close');
 assert.match(h.html(),/Terminus atteint<\/strong>/);
 h.click('go_closing');h.click('demo_confirm_empty_and_finish');
 assert.match(h.html(),/Terminus atteint<\/strong>/);
 assert.match(h.html(),/TERMINÉE/);
});
test('UI164/06: measured overflow scrolls exactly across hidden label space, like Chauffeur',()=>{
 const h=makeUI({width:120,natural:223});
 assert.equal(h.style().get('--stop-name-offset'),'-106px');
 assert.equal(h.style().get('--stop-name-duration'),'10.722222222222221s');
});
test('UI164/07: terminus label animates subtly even if short enough to fit',()=>{
 const h=makeUI({width:240,natural:200});goTerminus(h);
 assert.ok(h.classes().has('stop-name-overflow'));
 assert.equal(h.style().get('--stop-name-offset'),'24px');
 assert.equal(h.style().get('--stop-name-duration'),'7s');
});
test('UI164/08: resize recalculates marquee, and short ordinary stop is static',()=>{
 const h=makeUI({width:120,natural:223});
 assert.ok(h.classes().has('stop-name-overflow'));
 h.resized(280,180);
 assert.equal(h.classes().has('stop-name-overflow'),false);
});
test('UI164/09: no network, real stops or real signed approval inserted',()=>{
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|new WebSocket/);
 const h=makeUI();assert.match(h.html(),/DÉMO · Sans serveur réel/);
});
