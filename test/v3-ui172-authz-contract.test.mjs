import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeOperationalAction as auth,assertOperationalGatewayReady as gates} from '../mobile-session22/operational-policy.mjs';
const context={serverVerified:true,authenticationStrength:'verified'};
const trip={organizationId:'SCHOOL-A',tripId:'TRIP-1'};
const make=(role,extra={})=>({id:'USER-1',source:'trusted_gateway',active:true,role,
 organizationId:'SCHOOL-A',assignedTripIds:['TRIP-1'],authorizedStudentIds:['STUDENT-1'],...extra});
const check=(principal,action,resource=trip,verifiedContext=context)=>auth({principal,action,resource,verifiedContext});
test('UI172/AUTH01: no trusted verification means deny, even if the role looks valid',()=>{
 assert.equal(check(make('driver'),'trip.start',trip,null).ok,false);
 assert.equal(check(make('driver'),'trip.start',trip,{serverVerified:false}).ok,false);
 assert.equal(check(make('driver',{source:'demo'}),'trip.start').ok,false);
});
test('UI172/AUTH02: driver action allowed only with verified identity and assigned trip',()=>{
 assert.equal(check(make('driver'),'trip.start').ok,true);
 assert.equal(check(make('driver',{assignedTripIds:[] }),'trip.start').code,'TRIP_ASSIGNMENT_DENIED');
 assert.equal(check(make('driver',{active:false}),'trip.start').ok,false);
});
test('UI172/AUTH03: cross-organization action is denied',()=>{
 assert.equal(check(make('driver'),'trip.start',{...trip,organizationId:'SCHOOL-B'}).code,'SCOPE_DENIED');
});
test('UI172/AUTH04: attendant cannot approve supervisor review or start trip',()=>{
 assert.equal(check(make('attendant'),'trip.start').code,'ROLE_DENIED');
 assert.equal(check(make('attendant'),'change.review').code,'ROLE_DENIED');
 assert.equal(check(make('attendant'),'student.board').ok,true);
});
test('UI172/AUTH05: parent accesses only assigned child and cannot operate a trip',()=>{
 const parent=make('parent');
 assert.equal(check(parent,'child.read',{organizationId:'SCHOOL-A',studentId:'STUDENT-1'}).ok,true);
 assert.equal(check(parent,'child.read',{organizationId:'SCHOOL-A',studentId:'STUDENT-2'}).code,'PARENT_CHILD_DENIED');
 assert.equal(check(parent,'trip.start').code,'ROLE_DENIED');
});
test('UI172/AUTH06: supervisor cannot self-approve a requested review',()=>{
 const supervisor=make('supervisor');
 assert.equal(check(supervisor,'change.review',{...trip,requestedBy:'USER-1'}).code,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(check(supervisor,'change.review',{...trip,requestedBy:'OTHER-USER'}).ok,true);
 assert.equal(check(supervisor,'incident.report').code,'ROLE_DENIED');
});
test('UI172/AUTH07: unexpected role, missing scopes and action default to deny',()=>{
 assert.equal(check(make('administrator'),'trip.start').ok,false);
 assert.equal(check(make('driver'),'trip.start',{}).ok,false);
 assert.equal(check(make('driver'),'trip.delete').code,'ROLE_DENIED');
});
test('UI172/GATE01: operational gate defaults to closed',()=>{
 const result=gates();
 assert.equal(result.ok,false);
 assert.equal(result.missing.length,5);
});
test('UI172/GATE02: supplied flags do not certify real deployment verification',()=>{
 const result=gates({identityProviderVerified:true,tlsEnforced:true,persistentAudit:true,
 durableState:true,offlineConflictStrategyVerified:true});
 assert.equal(result.code,'PREREQUISITES_DECLARED_NOT_INDEPENDENTLY_VERIFIED');
});
test.todo('UI172/REAL: integrate trusted identity provider and secure server middleware');
test.todo('UI172/REAL: enforce TLS, durable audit and persistence in deployment');
test.todo('UI172/REAL: prove offline conflict recovery and real-device role isolation');
