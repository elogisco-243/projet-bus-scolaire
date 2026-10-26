import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../mobile-session19/app.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../mobile-session19/style.css',import.meta.url),'utf8');
test('UI170/CLOSE01: final inspection action precedes checklist',()=>{
 const view=app.slice(app.indexOf("if(view==='closing')"),app.indexOf("if(view==='closing')")+1100);
 assert.ok(view.includes('closing-primary-action'));
 assert.ok(view.indexOf('closing-primary-action')<view.indexOf('d.closure.map'));
 assert.ok(view.includes('demo_confirm_empty_and_finish'));
 assert.ok(view.includes('!d.canOpenClosing'));
});
test('UI170/CLOSE02: final safety guards remain enforced',()=>{
 const model=readFileSync(new URL('../mobile-session19/attendant-demo.mjs',import.meta.url),'utf8');
 for(const guard of ['ROUTE_NOT_COMPLETED','STUDENTS_NOT_RECONCILED','CHILDREN_REMAIN','OPEN_INCIDENTS','checkClosure'])assert.ok(model.includes(guard));
});
test('UI170/BOARD01: occupied-bus attention only during active trip',()=>{
 assert.ok(app.includes("d.status==='in_progress'&&d.onboard>0?' indicator-onboard':''"));
 assert.ok(css.includes('.hero-stat.indicator-onboard:not(.indicator-pending)'));
 assert.ok(css.includes('@keyframes ui170-onboard-border'));
});
test('UI170/BOARD02: reduced-motion and forced-color options',()=>{
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('@media(forced-colors:active)'));
 assert.ok(css.includes('.closing-primary-action button'));
});
