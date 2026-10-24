'use strict';

// SYNC-03 phase 2: PostgreSQL read adapter. NOT mounted or deployed.
// The external issuer MUST sign the custom actor_id UUID and immutable sub.
// The DB role is checked on each transaction; no UI field grants permissions.
const {withRlsActorTransaction,createActorProof}=require('./rls-session');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid=s=>typeof s==='string'&&UUID.test(s);
const validSubject=s=>typeof s==='string'&&s.length>0&&s.length<=255;

function createSync03PgReader({pool,signingSecretHex}) {
  if(!pool||typeof pool.connect!=='function'||typeof signingSecretHex!=='string')
    throw new TypeError('PostgreSQL pool and HMAC secret are required');
  createActorProof('11111111-1111-4111-8111-111111111111',signingSecretHex);

  async function readAs(actorId,callback) {
    return withRlsActorTransaction(pool,actorId,signingSecretHex,async db=>{
      await db.query('SET LOCAL ROLE bus_v3_reader');
      const role=await db.query("SELECT current_user AS role,current_setting('transaction_read_only') AS read_only");
      if(role.rows[0]?.role!=='bus_v3_reader'||role.rows[0]?.read_only!=='on')
        throw Error('RLS_READER_REQUIRED');
      return callback(db);
    });
  }

  async function resolveActiveActor(db,subject,actorId) {
    const user=await db.query(
      'SELECT id::text AS id FROM public.users WHERE id=$1::uuid AND identity_subject=$2 AND active=true',
      [actorId,subject]);
    if(user.rows.length!==1)return null;
    const memberships=await db.query([
      'SELECT m.organization_id::text AS "organizationId",m.role,m.active',
      'FROM public.organization_memberships m',
      'JOIN public.organizations o ON o.id=m.organization_id AND o.active=true',
      'WHERE m.user_id=$1::uuid AND m.active=true ORDER BY m.role,m.organization_id'
    ].join(' '),[actorId]);
    const links=await db.query([
      'SELECT l.student_id::text AS id FROM public.verified_parent_student_links l',
      'JOIN public.students s ON s.id=l.student_id AND s.active=true',
      'WHERE l.parent_user_id=$1::uuid AND l.revoked_at IS NULL'
    ].join(' '),[actorId]);
    return {
      userId:user.rows[0].id,
      memberships:memberships.rows.map(m=>({
        organizationId:m.organizationId,role:m.role,active:m.active===true
      })),
      verifiedStudentIds:links.rows.map(l=>l.id)
    };
  }

  async function loadActor(subject,verified) {
    if(!validSubject(subject)||verified?.subject!==subject||
       !uuid(verified?.actorId))return null;
    const actorId=verified.actorId.toLowerCase();
    const actor=await readAs(actorId,db=>resolveActiveActor(db,subject,actorId));
    if(!actor)return null;
    // Non-enumerable; never returned from /me.
    Object.defineProperty(actor,'identitySubject',{value:subject,enumerable:false});
    return actor;
  }

  async function loadTripSnapshot(actor,tripId) {
    if(!uuid(actor?.userId)||!uuid(tripId)||!validSubject(actor.identitySubject))
      return null;
    return readAs(actor.userId,async db=>{
      // Fresh permissions and links, not the stale /me call, are authoritative.
      const fresh=await resolveActiveActor(db,actor.identitySubject,actor.userId);
      if(!fresh)return null;
      const tripResult=await db.query([
        'SELECT t.id::text AS id,t.school_id::text AS "schoolId",',
        't.operator_id::text AS "operatorId",t.driver_user_id::text AS "driverUserId",',
        't.status,r.route_code AS "routeCode"',
        'FROM public.trips t JOIN public.routes r ON r.id=t.route_id',
        'WHERE t.id=$1::uuid'
      ].join(' '),[tripId]);
      const trip=tripResult.rows[0];
      if(!trip)return null;

      const assignments=await db.query([
        'SELECT trip_id::text AS "tripId",attendant_user_id::text AS "userId",',
        '(revoked_at IS NULL) AS active,revoked_at AS "revokedAt"',
        'FROM public.trip_attendants WHERE trip_id=$1::uuid'
      ].join(' '),[tripId]);
      const students=await db.query([
        'SELECT student_id::text AS id FROM public.trip_students',
        'WHERE trip_id=$1::uuid ORDER BY student_id LIMIT 500'
      ].join(' '),[tripId]);
      const statuses=await db.query([
        'SELECT DISTINCT ON (student_id) student_id::text AS "studentId",action',
        'FROM public.trip_student_events WHERE trip_id=$1::uuid',
        'ORDER BY student_id,sequence_no DESC'
      ].join(' '),[tripId]);
      const events=await db.query([
        'SELECT event_id::text AS "eventId",student_id::text AS "studentId",action,',
        "to_char(occurred_at AT TIME ZONE 'UTC',",
        "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"occurredAt\"",
        'FROM public.trip_student_events WHERE trip_id=$1::uuid',
        'ORDER BY accepted_at DESC,event_id DESC LIMIT 500'
      ].join(' '),[tripId]);
      const stops=await db.query([
        'SELECT s.id::text AS id,s.sequence_no AS sequence,s.label',
        'FROM public.route_stops s',
        'JOIN public.trips t ON t.route_id=s.route_id',
        'WHERE t.id=$1::uuid ORDER BY s.sequence_no LIMIT 200'
      ].join(' '),[tripId]);

      actor.memberships=fresh.memberships;
      actor.verifiedStudentIds=fresh.verifiedStudentIds;
      return {
        trip,tripStudentIds:students.rows.map(s=>s.id),
        attendantAssignments:assignments.rows,
        studentStatuses:statuses.rows.map(s=>({
          studentId:s.studentId,status:s.action==='board'?'aboard':'alighted'
        })),
        studentEvents:events.rows,
        // Arrival progress is NOT stored in this V3 schema.
        routeStops:stops.rows.map(s=>({
          id:s.id,sequence:s.sequence,label:s.label,reached:false
        }))
      };
    });
  }
  return {loadActor,loadTripSnapshot};
}
module.exports={createSync03PgReader};
