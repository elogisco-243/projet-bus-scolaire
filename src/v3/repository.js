'use strict';

// Adaptateur compatible avec un client/pool node-postgres ayant query(sql, params).
// Un rôle de base de données en lecture seule et des politiques RLS restent
// obligatoires avant déploiement. Ce module ne crée aucune connexion lui-même.
function createV3Repository(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Client SQL requis');

  return {
    async loadActor(identitySubject) {
      const users = await db.query(
        'SELECT id::text AS id FROM users WHERE identity_subject=$1 AND active=true',
        [identitySubject]
      );
      const user = users.rows[0];
      if (!user) return null;
      const memberships = await db.query(`
        SELECT m.organization_id::text AS "organizationId", m.role, m.active
        FROM organization_memberships m
        JOIN organizations o ON o.id=m.organization_id
        WHERE m.user_id=$1::uuid AND m.active=true AND o.active=true
      `, [user.id]);
      const links = await db.query(`
        SELECT s.id::text AS id
        FROM verified_parent_student_links l
        JOIN students s ON s.id=l.student_id AND s.active=true
        JOIN organizations o ON o.id=s.school_id AND o.active=true
        JOIN organization_memberships m ON m.organization_id=s.school_id
          AND m.user_id=l.parent_user_id AND m.role='parent' AND m.active=true
        WHERE l.parent_user_id=$1::uuid AND l.revoked_at IS NULL
      `, [user.id]);
      return {
        userId: user.id,
        memberships: memberships.rows.map(row => ({
          organizationId: row.organizationId, role: row.role, active: row.active === true
        })),
        verifiedStudentIds: links.rows.map(row => row.id)
      };
    },

    async getTripContext(tripId) {
      const result = await db.query(`
        SELECT t.id::text AS id, t.school_id::text AS "schoolId",
          t.operator_id::text AS "operatorId", t.driver_user_id::text AS "driverUserId",
          t.status, t.scheduled_start_at AS "scheduledStartAt", r.route_code AS "routeCode"
        FROM trips t JOIN routes r ON r.id=t.route_id
        WHERE t.id=$1::uuid
      `, [tripId]);
      const trip = result.rows[0];
      if (!trip) return null;
      const students = await db.query(`
        SELECT student_id::text AS id FROM trip_students WHERE trip_id=$1::uuid
      `, [tripId]);
      return { trip, tripStudentIds: students.rows.map(x => x.id) };
    },

    async listTripContexts(actor, limit, offset) {
      // Le SQL filtre *avant pagination* ; second contrôle fait dans l'API.
      const result = await db.query(`
        SELECT t.id::text AS id, t.school_id::text AS "schoolId",
          t.operator_id::text AS "operatorId", t.driver_user_id::text AS "driverUserId",
          t.status, t.scheduled_start_at AS "scheduledStartAt", r.route_code AS "routeCode",
          ARRAY(SELECT ts.student_id::text FROM trip_students ts
                WHERE ts.trip_id=t.id) AS "tripStudentIds"
        FROM trips t JOIN routes r ON r.id=t.route_id
        WHERE EXISTS (
          SELECT 1 FROM organization_memberships m
          JOIN organizations o ON o.id=m.organization_id AND o.active=true
          WHERE m.user_id=$1::uuid AND m.active=true AND (
            (m.organization_id=t.school_id AND m.role='school_admin') OR
            (m.organization_id=t.operator_id AND m.role IN ('operator_admin','dispatcher')) OR
            (m.organization_id=t.operator_id AND m.role='driver'
              AND t.driver_user_id=$1::uuid) OR
            (m.organization_id=t.school_id AND m.role='parent' AND EXISTS (
              SELECT 1 FROM trip_students ts
              JOIN students s ON s.id=ts.student_id AND s.school_id=t.school_id
                AND s.active=true
              JOIN verified_parent_student_links l ON l.student_id=s.id
                AND l.parent_user_id=$1::uuid AND l.revoked_at IS NULL
              WHERE ts.trip_id=t.id
            ))
          )
        )
        ORDER BY t.scheduled_start_at DESC, t.id DESC
        LIMIT $2 OFFSET $3
      `, [actor.userId, limit + 1, offset]);
      return result.rows.map(({ tripStudentIds, ...trip }) => ({trip, tripStudentIds}));
    },

    async listVehicles(actor, limit, offset) {
      const result = await db.query(`
        SELECT v.id::text AS id, v.operator_id::text AS "operatorId",
          v.fleet_code AS "fleetCode", v.seat_capacity AS "seatCapacity", v.active
        FROM vehicles v
        WHERE EXISTS (
          SELECT 1 FROM organization_memberships m
          JOIN organizations o ON o.id=m.organization_id AND o.active=true
          WHERE m.user_id=$1::uuid AND m.organization_id=v.operator_id
            AND m.active=true AND m.role IN ('operator_admin','dispatcher')
        )
        ORDER BY v.fleet_code, v.id LIMIT $2 OFFSET $3
      `, [actor.userId, limit + 1, offset]);
      return result.rows;
    }
  };
}

module.exports = { createV3Repository };
