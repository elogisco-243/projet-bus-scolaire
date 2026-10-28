import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourRoleDemo} from '../mobile-session19/four-role-demo-workflow.mjs';
import {parentDemoDashboard,supervisorDemoDashboard} from '../mobile-session19/parent-supervisor-demo-dashboard.mjs';
test('Parent limits pupils to explicitly scoped demo account',()=>{
 const s=createFourRoleDemo();
 assert.equal(parentDemoDashboard(s).pupils.length,0);
 assert.deepEqual(parentDemoDashboard(s,{pupilIds:['A-01']}).pupils.map(p=>p.id),['A-01']);
});
test('Superviseur includes incident counts and route data',()=>{
 const s=createFourRoleDemo();
 assert.equal(supervisorDemoDashboard(s).routeName,'Circuit Golf');
 assert.equal(supervisorDemoDashboard(s).busId,'LUB-014');
});
test('HTML screen shell has only new own assets',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../mobile-session23/index.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../mobile-session23/role-screens.mjs',import.meta.url),'utf8');
 assert.match(html,/role-screens\.mjs/);
 assert.match(js,/parentDemoDashboard/);
 assert.match(js,/supervisorDemoDashboard/);
 assert.match(js,/Aucun suivi GPS/);
 assert.doesNotMatch(js,/fetch\s*\(/);
});
