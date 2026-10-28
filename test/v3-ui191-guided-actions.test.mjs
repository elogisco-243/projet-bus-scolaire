import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourRoleDemo,executeFourRoleDemo} from '../mobile-session19/four-role-demo-workflow.mjs';
import {guidedRoleView,executeSuggestedDemoAction,classifySuggestedAction,dispatchRealWorldAction} from '../mobile-session19/four-role-guided-actions.mjs';
const apply=(s,role,action)=>{const r=executeFourRoleDemo(s,{role,action});assert.equal(r.ok,true);return r.snapshot;};
test('driver contextual suggestion executes through reducer',()=>{
 const s=createFourRoleDemo();
 assert.equal(classifySuggestedAction(s,'driver').primary.action,'secure_vehicle');
 const r=executeSuggestedDemoAction(s,{role:'driver',action:'secure_vehicle'});
 assert.equal(r.ok,true);assert.equal(r.snapshot.secured,true);
 assert.equal(s.secured,false);
});
test('suggested button cannot bypass readiness and actions not suggested are denied',()=>{
 let s=createFourRoleDemo();
 assert.equal(executeSuggestedDemoAction(s,{role:'driver',action:'begin'}).code,'NOT_CURRENT_PRIMARY_ACTION');
 s=apply(s,'driver','secure_vehicle');
 assert.equal(classifySuggestedAction(s,'driver').executable,false);
 assert.equal(executeSuggestedDemoAction(s,{role:'driver',action:'view_team'}).code,'NAVIGATION_ONLY_OR_REQUIRES_CONTEXT');
});
test('attendant and driver share same demo snapshot while parent sees only scoped pupil',()=>{
 let s=createFourRoleDemo();
 s=executeSuggestedDemoAction(s,{role:'attendant',action:'check_in'}).snapshot;
 s=executeSuggestedDemoAction(s,{role:'driver',action:'secure_vehicle'}).snapshot;
 s=executeSuggestedDemoAction(s,{role:'attendant',action:'ready'}).snapshot;
 assert.equal(classifySuggestedAction(s,'driver').primary.action,'begin');
 const started=executeSuggestedDemoAction(s,{role:'driver',action:'begin'});
 assert.equal(started.ok,true);
 assert.equal(guidedRoleView(started.snapshot,'parent').view.students.length,0);
 assert.deepEqual(guidedRoleView(started.snapshot,'parent',{parentStudentIds:['A-01']}).view.students.map(x=>x.id),['A-01']);
});
test('supervisor has read-only navigation until a completed trip',()=>{
 const s=createFourRoleDemo();
 assert.equal(classifySuggestedAction(s,'supervisor').primary.action,'view_overview');
 assert.equal(classifySuggestedAction(s,'supervisor').executable,false);
 assert.equal(executeSuggestedDemoAction(s,{role:'supervisor',action:'review_trip'}).code,'NOT_CURRENT_PRIMARY_ACTION');
});
test('real-world commands unavailable and primary action cannot be role forged',()=>{
 const s=createFourRoleDemo();
 assert.equal(dispatchRealWorldAction().code,'OPERATIONAL_DISPATCH_DISABLED');
 assert.equal(executeSuggestedDemoAction(s,{role:'parent',action:'secure_vehicle'}).code,'NOT_CURRENT_PRIMARY_ACTION');
 assert.equal(classifySuggestedAction(s,'driver').operationalEnabled,false);
});
