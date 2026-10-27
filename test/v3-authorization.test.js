'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasMembership, canViewTrip, canTrackLiveBus, canPublishTripPosition,
  canManageVehicle, canManageStudent, canManageRoute
} = require('../src/v3/authorization');

const membership = (organizationId, role, active=true) => ({organizationId, role, active});
const schoolAdmin = {userId:'school-1', memberships:[membership('school-A','school_admin')]};
const operatorAdmin = {userId:'operator-1', memberships:[membership('operator-A','operator_admin')]};
const dispatcher = {userId:'dispatcher-1', memberships:[membership('operator-A','dispatcher')]};
const driver = {userId:'driver-1', memberships:[membership('operator-A','driver')]};
const parent = {
  userId:'parent-1', memberships:[membership('school-A','parent')],
  verifiedStudentIds:['child-A']
};
const trip = {
  id:'trip-1', schoolId:'school-A', operatorId:'operator-A',
  driverUserId:'driver-1', status:'in_progress'
};
const ctx = {trip, tripStudentIds:['child-A']};

test('deny by default for malformed and unverified identities', () => {
  assert.equal(canViewTrip({}, ctx), false);
  assert.equal(canViewTrip({userId:'ghost',memberships:[]}, ctx), false);
  assert.equal(canViewTrip({...parent,memberships:[membership('school-A','parent',false)]},ctx),false);
  assert.equal(canTrackLiveBus(parent, {}),false);
  assert.equal(canPublishTripPosition({},ctx),false);
});

test('verified school admin can view their school trips only', () => {
  assert.equal(canViewTrip(schoolAdmin,ctx),true);
  assert.equal(canViewTrip(schoolAdmin,{...ctx,trip:{...trip,schoolId:'school-B'}}),false);
});

test('operators and dispatchers are scoped to operator organization', () => {
  assert.equal(canViewTrip(operatorAdmin,ctx),true);
  assert.equal(canViewTrip(dispatcher,ctx),true);
  const other={...ctx,trip:{...trip,operatorId:'operator-B'}};
  assert.equal(canViewTrip(operatorAdmin,other),false);
  assert.equal(canViewTrip(dispatcher,other),false);
});

test('driver can publish only for assigned active trip', () => {
  assert.equal(canPublishTripPosition(driver,ctx),true);
  assert.equal(canPublishTripPosition(driver,{...ctx,trip:{...trip,driverUserId:'other'}}),false);
  assert.equal(canPublishTripPosition(driver,{...ctx,trip:{...trip,status:'completed'}}),false);
  assert.equal(canPublishTripPosition(parent,ctx),false);
  assert.equal(canPublishTripPosition(operatorAdmin,ctx),false);
});

test('parent must be linked to a student on the trip AND school membership', () => {
  assert.equal(canViewTrip(parent,ctx),true);
  assert.equal(canViewTrip(parent,{...ctx,tripStudentIds:['child-B']}),false);
  assert.equal(canViewTrip({...parent,verifiedStudentIds:[]},ctx),false);
  assert.equal(canViewTrip({...parent,memberships:[membership('school-B','parent')]},ctx),false);
  assert.equal(canViewTrip({...parent,verifiedStudentIds:['child-B']},ctx),false);
});

test('trip live position is hidden when trip is inactive', () => {
  assert.equal(canTrackLiveBus(parent,ctx),true);
  assert.equal(canTrackLiveBus(parent,{...ctx,trip:{...trip,status:'planned'}}),false);
  assert.equal(canTrackLiveBus(schoolAdmin,{...ctx,trip:{...trip,status:'completed'}}),false);
});

test('only operator admins manage their vehicles', () => {
  assert.equal(canManageVehicle(operatorAdmin,{operatorId:'operator-A'}),true);
  assert.equal(canManageVehicle(schoolAdmin,{operatorId:'operator-A'}),false);
  assert.equal(canManageVehicle(operatorAdmin,{operatorId:'operator-B'}),false);
});

test('only school admins manage students from own school', () => {
  assert.equal(canManageStudent(schoolAdmin,{schoolId:'school-A'}),true);
  assert.equal(canManageStudent(operatorAdmin,{schoolId:'school-A'}),false);
  assert.equal(canManageStudent(schoolAdmin,{schoolId:'school-B'}),false);
});

test('route modification additionally requires active school-operator agreement', () => {
  const route={schoolId:'school-A',operatorId:'operator-A'};
  assert.equal(canManageRoute(schoolAdmin,route,true),true);
  assert.equal(canManageRoute(operatorAdmin,route,true),true);
  assert.equal(canManageRoute(operatorAdmin,route,false),false);
  assert.equal(canManageRoute(dispatcher,route,true),false);
  assert.equal(canManageRoute(parent,route,true),false);
  assert.equal(hasMembership({},'school_admin','school-A'),false);
});
