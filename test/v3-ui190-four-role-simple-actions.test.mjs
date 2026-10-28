import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourRoleDemo,executeFourRoleDemo} from '../mobile-session19/four-role-demo-workflow.mjs';
import {nextSimpleAction} from '../mobile-session19/four-role-simple-actions.mjs';
const go=(s,role,action,args={})=>{const r=executeFourRoleDemo(s,{role,action,...args});assert.equal(r.ok,true,action+': '+r.code);return r.snapshot;};
test('Chauffeur: readiness then departure without hiding safety steps',()=>{
 let s=createFourRoleDemo();
 assert.equal(nextSimpleAction(s,'driver').primary.action,'secure_vehicle');
 s=go(s,'driver','secure_vehicle');
 assert.equal(nextSimpleAction(s,'driver').primary.action,'view_team');
 s=go(s,'attendant','check_in');s=go(s,'attendant','ready_departure');
 const p=nextSimpleAction(s,'driver').primary;
 assert.equal(p.action,'begin');assert.equal(p.requiresConfirmation,true);
});
test('Accompagnateur: presence, readiness and pointage context',()=>{
 let s=createFourRoleDemo();
 assert.equal(nextSimpleAction(s,'attendant').primary.action,'check_in');
 s=go(s,'attendant','check_in');s=go(s,'driver','secure_vehicle');
 assert.equal(nextSimpleAction(s,'attendant').primary.action,'ready');
 s=go(s,'attendant','ready_departure');s=go(s,'driver','start_trip');
 s=go(s,'driver','secure_vehicle');s=go(s,'driver','arrive_stop');
 assert.equal(nextSimpleAction(s,'attendant').primary.action,'go_students');
});
test('Parent: notifications only for associated children',()=>{
 let s=createFourRoleDemo();
 s.notifications=[{studentId:'A-02',status:'unread'}];
 assert.equal(nextSimpleAction(s,'parent',{parentStudentIds:['A-01']}).primary.action,'view_child');
 assert.equal(nextSimpleAction(s,'parent',{parentStudentIds:['A-02']}).primary.action,'view_notifications');
});
test('Superviseur: incident first; four navigation slots',()=>{
 let s=createFourRoleDemo();
 assert.equal(nextSimpleAction(s,'supervisor').primary.action,'view_overview');
 s.incidents=[{id:'I1',kind:'traffic',status:'open'}];
 assert.equal(nextSimpleAction(s,'supervisor').primary.action,'view_alerts');
 assert.equal(nextSimpleAction(s,'supervisor').secondary.length,4);
});
test('fail closed on invalid role and never mutate state',()=>{
 const s=createFourRoleDemo(),before=JSON.stringify(s);
 assert.equal(nextSimpleAction(s,'admin').code,'ROLE_UNKNOWN');
 assert.equal(nextSimpleAction(s,'driver').operationalEnabled,false);
 assert.equal(JSON.stringify(s),before);
});
