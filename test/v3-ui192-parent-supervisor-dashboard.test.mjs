import test from 'node:test';
import assert from 'node:assert/strict';
import {createFourRoleDemo,executeFourRoleDemo} from '../mobile-session19/four-role-demo-workflow.mjs';
import {parentDemoDashboard,supervisorDemoDashboard,parentOrSupervisorOperationalAccess} from '../mobile-session19/parent-supervisor-demo-dashboard.mjs';
const run=(s,role,action,fields={})=>{const r=executeFourRoleDemo(s,{role,action,...fields});assert.equal(r.ok,true,action+': '+r.code);return r.snapshot;};
test('parent receives only explicitly selected demo pupils',()=>{
 const s=createFourRoleDemo();
 assert.deepEqual(parentDemoDashboard(s).pupils,[]);
 const p=parentDemoDashboard(s,{pupilIds:['A-01']});
 assert.deepEqual(p.pupils.map(v=>v.id),['A-01']);
 assert.equal(p.busId,'LUB-014');assert.equal(p.locationAvailable,false);
});
test('parent does not receive notifications for another pupil',()=>{
 let s=createFourRoleDemo();
 s=run(s,'attendant','check_in');s=run(s,'driver','secure_vehicle');
 s=run(s,'attendant','ready_departure');s=run(s,'driver','start_trip');
 s=run(s,'driver','secure_vehicle');s=run(s,'driver','arrive_stop');
 s=run(s,'attendant','board',{studentId:'A-01'});
 const a=parentDemoDashboard(s,{pupilIds:['A-01']});
 const b=parentDemoDashboard(s,{pupilIds:['A-02']});
 assert.equal(a.notifications.length,1);
 assert.equal(b.notifications.length,0);
 assert.equal(a.pupils[0].state,'a bord');
});
test('supervisor receives route progress and open incidents',()=>{
 let s=createFourRoleDemo();
 s=run(s,'driver','report_incident',{kind:'breakdown'});
 const d=supervisorDemoDashboard(s);
 assert.equal(d.routeName,'Circuit Golf');
 assert.equal(d.incidents.length,1);assert.equal(d.incidents[0].status,'open');
 assert.equal(d.primary.action,'view_alerts');
});
test('operational access remains disabled',()=>{
 assert.equal(parentOrSupervisorOperationalAccess().code,'OPERATIONAL_DISPATCH_DISABLED');
 assert.equal(parentDemoDashboard(createFourRoleDemo()).canChangeTrip,false);
 assert.equal(supervisorDemoDashboard(createFourRoleDemo()).canAuthorizeOperational,false);
});
