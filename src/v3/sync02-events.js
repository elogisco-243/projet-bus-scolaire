'use strict';

// SYNC-02: pure, fail-closed policy + offline queue event validation.
// Inputs other than the event must be assembled by the authenticated server
// from PostgreSQL, never copied from client JSON.
const { hasMembership } = require('./authorization');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['board', 'alight']);
function uuid(s) { return typeof s === 'string' && UUID.test(s); }
function fail(reason) { return { ok: false, reason }; }

function parseOfflineStudentEvent(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('INVALID_EVENT');
  const { id, tripId, studentId, stopId, type, occurredAt } = input;
  if (![id, tripId, studentId].every(uuid) ||
      (stopId !== null && stopId !== undefined && !uuid(stopId)) ||
      !ACTIONS.has(type)) return fail('INVALID_EVENT');
  if (typeof occurredAt !== 'string' || occurredAt.length > 35 ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(occurredAt))
    return fail('INVALID_TIME');
  const at = Date.parse(occurredAt);
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 19) !== occurredAt.slice(0, 19) ||
      new Date(at).getUTCFullYear() < 2020 ||
      at > now + 5 * 60 * 1000 || at < now - 72 * 3600 * 1000)
    return fail('TIME_OUT_OF_WINDOW');
  // Deliberate allowlist: actor, role, parked, permissions, detail, status
  // and source-supplied versions can never grant access.
  return { ok: true, event: {
    id: id.toLowerCase(), tripId: tripId.toLowerCase(),
    studentId: studentId.toLowerCase(),
    stopId: stopId == null ? null : stopId.toLowerCase(),
    type, occurredAt: new Date(at).toISOString()
  }};
}

function evaluateStudentPointage(actor, context, event) {
  if (!actor || !uuid(actor.userId) || !context || !event) return fail('NOT_AUTHORIZED');
  const trip = context.trip;
  if (!trip || !uuid(trip.id) || event.tripId !== trip.id ||
      trip.status !== 'in_progress' || !uuid(trip.operatorId)) return fail('NOT_AUTHORIZED');
  if (!Array.isArray(context.tripStudentIds) ||
      !context.tripStudentIds.includes(event.studentId)) return fail('NOT_AUTHORIZED');
  if (context.parkedConfirmed !== true) return fail('BUS_NOT_PARKED');

  // The stop must be confirmed from an authoritative server-side trip state.
  const stopId = event.stopId || context.currentStopId;
  if (!uuid(stopId) || !Array.isArray(context.routeStopIds) ||
      !context.routeStopIds.includes(stopId) ||
      (event.stopId && event.stopId !== context.currentStopId))
    return fail('STOP_NOT_CONFIRMED');

  const assignedAttendants = Array.isArray(context.attendantAssignments)
    ? context.attendantAssignments.filter(a => a && a.active === true && a.revokedAt == null &&
        a.tripId === trip.id && uuid(a.userId)) : [];
  const attendant = hasMembership(actor, 'attendant', trip.operatorId) &&
    assignedAttendants.some(a => a.userId === actor.userId);
  const solo = context.soloAuthorization;
  const soloDriver = hasMembership(actor, 'driver', trip.operatorId) &&
    actor.userId === trip.driverUserId && assignedAttendants.length === 0 &&
    solo && solo.tripId === trip.id && solo.driverUserId === actor.userId &&
    solo.revokedAt == null && solo.approved === true;
  if (!attendant && !soloDriver) return fail('NOT_AUTHORIZED');

  return { ok: true, actorUserId: actor.userId, stopId,
    pointageMode: attendant ? 'attendant' : 'authorized_solo' };
}

function materializeAuthorizedEvent(event, decision) {
  if (!event || decision?.ok !== true || !uuid(decision.actorUserId) ||
      !uuid(decision.stopId)) return fail('NOT_AUTHORIZED');
  return { ok: true, record: { ...event, stopId: decision.stopId,
    actorUserId: decision.actorUserId } };
}

function checkIdempotency(existing, event, actorUserId) {
  if (!existing) return { ok: true, result: 'recorded' };
  // Never acknowledge another actor's event or a reused ID with new payload.
  if (existing.actorUserId !== actorUserId ||
      existing.id !== event.id || existing.tripId !== event.tripId ||
      existing.studentId !== event.studentId || existing.stopId !== event.stopId ||
      existing.type !== event.type || existing.occurredAt !== event.occurredAt)
    return fail('IDEMPOTENCY_CONFLICT');
  return { ok: true, result: 'already_recorded' };
}

module.exports = { parseOfflineStudentEvent, evaluateStudentPointage, materializeAuthorizedEvent, checkIdempotency };
