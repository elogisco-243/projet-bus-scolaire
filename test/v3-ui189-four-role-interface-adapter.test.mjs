import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyLegacyGesture,simulateLegacyGesture,initialUnifiedDemo,readUnifiedRole,integrationStatus} from '../mobile-session19/four-role-interface-adapter.mjs';
test('the existing driver gestures map without touching UI',()=>{
 let state=initialUnifiedDemo();
 assert.equal(classifyLegacyGesture({profile:'driver',gesture:'begin'}).action,'start_trip');
 assert.equal(simulateLegacyGesture(state,{profile:'driver',gesture:'begin'}).code,'DEPARTURE_NOT_READY');
 assert.equal(integrationStatus.uiResourcesAltered,false);
});
test('attendant and driver collaborate over one detached demo snapshot',()=>{
 let state=initialUnifiedDemo();
 for(const [profile,gesture] of [['attendant','check_in'],['driver','secure_vehicle'],['attendant','ready'],['driver','begin']]){
  const result=simulateLegacyGesture(state,{profile,gesture});assert.equal(result.ok,true,gesture+': '+result.code);state=result.snapshot;
 }
 assert.equal(readUnifiedRole(state,{profile:'driver'}).status,'in_progress');
 assert.equal(readUnifiedRole(state,{profile:'supervisor'}).status,'in_progress');
});
test('parent view is scoped and supervisor cannot drive',()=>{
 const state=initialUnifiedDemo();
 assert.deepEqual(readUnifiedRole(state,{profile:'parent'}).students,[]);
 assert.deepEqual(readUnifiedRole(state,{profile:'parent',parentStudentIds:['A-02']}).students.map(x=>x.id),['A-02']);
 assert.equal(classifyLegacyGesture({profile:'supervisor',gesture:'begin'}).code,'LEGACY_ACTION_UNMAPPED');
});
test('operational, unmapped gestures and bad payloads refused',()=>{
 assert.equal(classifyLegacyGesture({profile:'driver',gesture:'begin',mode:'operational'}).code,'OPERATIONAL_DISPATCH_DISABLED');
 assert.equal(classifyLegacyGesture({profile:'attendant',gesture:'reset'}).code,'LEGACY_ACTION_UNMAPPED');
 assert.equal(classifyLegacyGesture({profile:'driver',gesture:'begin',payload:[]}).code,'INVALID_ACTION_PAYLOAD');
 assert.equal(integrationStatus.androidWired,false);
});
