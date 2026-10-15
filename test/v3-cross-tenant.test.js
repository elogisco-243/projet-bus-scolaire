'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canViewTrip, canTrackLiveBus, canPublishTripPosition,
  canManageVehicle, canManageStudent, canManageRoute
} = require('../src/v3/authorization');

const member = (organizationId, role, active = true) => ({organizationId, role, active});
const trip = {
  id: 'trip-alpha', schoolId: 'school-alpha', operatorId: 'operator-alpha',
  driverUserId: 'driver-alpha', status: 'in_progress'
};
const context = {trip, tripStudentIds: ['student-alpha']};

test('parent sans lien verifie ne peut lire aucun trajet, meme de son ecole', () => {
  const parent = {userId:'parent-a', memberships:[member('school-alpha','parent')]};
  assert.equal(canViewTrip(parent, context), false);
  assert.equal(canTrackLiveBus(parent, context), false);
});

test('parent ne voit ni le trajet autre ecole ni un autre enfant', () => {
  const parent = {userId:'parent-a', memberships:[member('school-alpha','parent')],
    verifiedStudentIds:['student-alpha']};
  assert.equal(canViewTrip(parent, context), true);
  assert.equal(canViewTrip(parent, {...context, tripStudentIds:['student-beta']}), false);
  assert.equal(canViewTrip(parent, {...context, trip:{...trip, schoolId:'school-beta'}}), false);
});

test('une adhesion inactive ne donne pas de pouvoir de chauffeur ni de transporteur', () => {
  const driver = {userId:'driver-alpha', memberships:[member('operator-alpha','driver',false)]};
  const admin = {userId:'admin-a', memberships:[member('operator-alpha','operator_admin',false)]};
  assert.equal(canPublishTripPosition(driver, context), false);
  assert.equal(canManageVehicle(admin, {operatorId:'operator-alpha'}), false);
});

test('transporteur et ecole differents ne peuvent administrer des ressources exterieures', () => {
  const operator = {userId:'admin-a', memberships:[member('operator-alpha','operator_admin')]};
  const school = {userId:'admin-school', memberships:[member('school-alpha','school_admin')]};
  assert.equal(canManageVehicle(operator, {operatorId:'operator-beta'}), false);
  assert.equal(canManageStudent(school, {schoolId:'school-beta'}), false);
  assert.equal(canManageRoute(operator, {schoolId:'school-beta',operatorId:'operator-beta'},true),false);
  assert.equal(canManageRoute(school, {schoolId:'school-alpha',operatorId:'operator-alpha'},false),false);
});

test('changement de chauffeur ne transfere pas les autorisations de suivi', () => {
  const driver = {userId:'driver-alpha', memberships:[member('operator-alpha','driver')]};
  assert.equal(canPublishTripPosition(driver, context),true);
  assert.equal(canPublishTripPosition(driver, {trip:{...trip,driverUserId:'driver-beta'}}),false);
  assert.equal(canPublishTripPosition(driver, {trip:{...trip,status:'completed'}}),false);
});
