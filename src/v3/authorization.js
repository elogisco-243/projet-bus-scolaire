'use strict';

// V3 authorizations are pure helpers. All actor context MUST come from a
// verified server-side identity and database queries, NEVER from client JSON.
const ACTIVE_TRIP = 'in_progress';

function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128;
}

function hasMembership(actor, role, organizationId) {
  return Boolean(actor && validId(actor.userId) && validId(organizationId) &&
    Array.isArray(actor.memberships) && actor.memberships.some(m =>
      m && m.role === role && m.organizationId === organizationId &&
      m.active === true));
}

function assignedDriver(actor, trip) {
  return Boolean(trip && validId(trip.operatorId) &&
    actor && validId(actor.userId) && actor.userId === trip.driverUserId &&
    hasMembership(actor, 'driver', trip.operatorId));
}

function verifiedGuardianForTrip(actor, tripContext) {
  const trip = tripContext?.trip;
  if (!trip || !validId(trip.schoolId)) return false;
  if (!hasMembership(actor, 'parent', trip.schoolId)) return false;
  const allowed = actor?.verifiedStudentIds;
  const assigned = tripContext?.tripStudentIds;
  if (!Array.isArray(allowed) || !Array.isArray(assigned)) return false;
  const studentIds = new Set(allowed.filter(validId));
  return assigned.some(id => validId(id) && studentIds.has(id));
}

function canViewTrip(actor, ctx) {
  const trip = ctx?.trip;
  if (!trip || !validId(trip.id) || !validId(trip.schoolId) || !validId(trip.operatorId)) return false;
  if (hasMembership(actor, 'school_admin', trip.schoolId)) return true;
  if (hasMembership(actor, 'operator_admin', trip.operatorId)) return true;
  if (hasMembership(actor, 'dispatcher', trip.operatorId)) return true;
  if (assignedDriver(actor, trip)) return true;
  return verifiedGuardianForTrip(actor, ctx);
}

function canTrackLiveBus(actor, ctx) {
  return Boolean(ctx?.trip?.status === ACTIVE_TRIP && canViewTrip(actor, ctx));
}

function canPublishTripPosition(actor, ctx) {
  return Boolean(ctx?.trip?.status === ACTIVE_TRIP && assignedDriver(actor, ctx.trip));
}

function canManageVehicle(actor, vehicle) {
  return Boolean(vehicle && hasMembership(actor, 'operator_admin', vehicle.operatorId));
}

function canManageStudent(actor, student) {
  return Boolean(student && hasMembership(actor, 'school_admin', student.schoolId));
}

function canManageRoute(actor, route, agreementActive) {
  if (!route || !validId(route.schoolId) || !validId(route.operatorId)) return false;
  if (agreementActive !== true) return false;
  return hasMembership(actor, 'school_admin', route.schoolId) ||
    hasMembership(actor, 'operator_admin', route.operatorId);
}

module.exports = {
  hasMembership, canViewTrip, canTrackLiveBus,
  canPublishTripPosition, canManageVehicle, canManageStudent, canManageRoute
};
