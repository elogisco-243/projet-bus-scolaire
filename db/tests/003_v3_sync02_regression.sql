-- SYNC-02 PostgreSQL 16 security tests; run ONLY on disposable CI database.
-- 001, 002, 003, 004 migrations must be applied in that order.
\set ON_ERROR_STOP on
\set school_a '11111111-1111-4111-8111-111111111111'
\set school_b '22222222-2222-4222-8222-222222222222'
\set operator_a '33333333-3333-4333-8333-333333333333'
\set operator_b '44444444-4444-4444-8444-444444444444'
\set parent_a '55555555-5555-4555-8555-555555555555'
\set att_a '66666666-6666-4666-8666-666666666666'
\set att_b '77777777-7777-4777-8777-777777777777'
\set op_admin_a '88888888-8888-4888-8888-888888888888'
\set op_admin_b '99999999-9999-4999-8999-999999999999'
\set school_admin_a 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set driver_a 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set driver_b 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set child_a 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set child_a2 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set child_b 'ffffffff-ffff-4fff-8fff-ffffffffffff'
\set bus_a '10000000-0000-4000-8000-000000000001'
\set bus_b '10000000-0000-4000-8000-000000000002'
\set route_a '20000000-0000-4000-8000-000000000001'
\set route_b '20000000-0000-4000-8000-000000000002'
\set trip_a '30000000-0000-4000-8000-000000000001'
\set trip_b '30000000-0000-4000-8000-000000000002'
\set stop_a '40000000-0000-4000-8000-000000000001'
\set stop_b '40000000-0000-4000-8000-000000000002'
\set ev_a_board '50000000-0000-4000-8000-000000000001'
\set ev_a_alight '50000000-0000-4000-8000-000000000002'
\set ev_a2_board '50000000-0000-4000-8000-000000000003'
\set ev_b_board '50000000-0000-4000-8000-000000000004'

BEGIN;
INSERT INTO bus_v3_rls.signing_keys(id,secret) VALUES (1,gen_random_bytes(32));
INSERT INTO organizations(id,kind,name) VALUES
(:'school_a','school','Test School A'),(:'school_b','school','Test School B'),
(:'operator_a','operator','Test Operator A'),(:'operator_b','operator','Test Operator B');
INSERT INTO users(id,identity_subject) VALUES
(:'parent_a','sync02-parent-a'),(:'att_a','sync02-att-a'),(:'att_b','sync02-att-b'),
(:'op_admin_a','sync02-op-a'),(:'op_admin_b','sync02-op-b'),
(:'school_admin_a','sync02-school-a'),(:'driver_a','sync02-driver-a'),(:'driver_b','sync02-driver-b');
INSERT INTO organization_memberships(organization_id,user_id,role) VALUES
(:'school_a',:'parent_a','parent'),(:'operator_a',:'att_a','attendant'),
(:'operator_b',:'att_b','attendant'),(:'operator_a',:'op_admin_a','operator_admin'),
(:'operator_b',:'op_admin_b','operator_admin'),
(:'school_a',:'school_admin_a','school_admin'),
(:'operator_a',:'driver_a','driver'),(:'operator_b',:'driver_b','driver');
DO $assert$
BEGIN
  IF (SELECT organization_kind FROM organization_memberships
      WHERE user_id='66666666-6666-4666-8666-666666666666' AND role='attendant') <> 'operator' THEN
    RAISE EXCEPTION 'FAIL: attendant role organization mapping';
  END IF;
END $assert$;
INSERT INTO school_operator_agreements(school_id,operator_id,status) VALUES
(:'school_a',:'operator_a','active'),(:'school_b',:'operator_b','active');
INSERT INTO students(id,school_id,school_student_ref) VALUES
(:'child_a',:'school_a','A-01'),(:'child_a2',:'school_a','A-02'),(:'child_b',:'school_b','B-01');
INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
VALUES(:'parent_a',:'child_a',now(),:'school_admin_a');
INSERT INTO vehicles(id,operator_id,fleet_code,seat_capacity) VALUES
(:'bus_a',:'operator_a','BUS-A',20),(:'bus_b',:'operator_b','BUS-B',20);
INSERT INTO routes(id,school_id,operator_id,route_code) VALUES
(:'route_a',:'school_a',:'operator_a','ROUTE-A'),(:'route_b',:'school_b',:'operator_b','ROUTE-B');
INSERT INTO route_stops(id,route_id,sequence_no,label,latitude,longitude) VALUES
(:'stop_a',:'route_a',1,'Stop A',-11.6,27.4),(:'stop_b',:'route_b',1,'Stop B',-11.7,27.5);
INSERT INTO trips(id,route_id,vehicle_id,driver_user_id,status,school_id,operator_id,scheduled_start_at)
VALUES(:'trip_a',:'route_a',:'bus_a',:'driver_a','in_progress',:'school_a',:'operator_a',now()),
(:'trip_b',:'route_b',:'bus_b',:'driver_b','in_progress',:'school_b',:'operator_b',now());
INSERT INTO trip_students(trip_id,student_id,school_id) VALUES
(:'trip_a',:'child_a',:'school_a'),(:'trip_a',:'child_a2',:'school_a'),(:'trip_b',:'child_b',:'school_b');

INSERT INTO trip_attendants(trip_id,attendant_user_id,assigned_by_user_id)
VALUES(:'trip_a',:'att_a',:'op_admin_a'),(:'trip_b',:'att_b',:'op_admin_b');
DO $assert$
BEGIN
  BEGIN
    INSERT INTO trip_attendants(trip_id,attendant_user_id,assigned_by_user_id)
      VALUES('30000000-0000-4000-8000-000000000002','66666666-6666-4666-8666-666666666666','88888888-8888-4888-8888-888888888888');
    RAISE EXCEPTION 'FAIL: cross-operator attendant assignment accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO trip_solo_authorizations(trip_id,driver_user_id,authorized_by_user_id)
      VALUES('30000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','88888888-8888-4888-8888-888888888888');
    RAISE EXCEPTION 'FAIL: solo approved while attendant present';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $assert$;

INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
VALUES(:'ev_a_board',:'trip_a',:'child_a',:'att_a',:'stop_a','board',now(),true),
(:'ev_a2_board',:'trip_a',:'child_a2',:'att_a',:'stop_a','board',now(),true),
(:'ev_b_board',:'trip_b',:'child_b',:'att_b',:'stop_b','board',now(),true);
INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
VALUES(:'ev_a_alight',:'trip_a',:'child_a',:'att_a',:'stop_a','alight',now(),true);

DO $assert$
BEGIN
  BEGIN
    INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
    VALUES('50000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000001',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '66666666-6666-4666-8666-666666666666',
      '40000000-0000-4000-8000-000000000001','alight',now(),true);
    RAISE EXCEPTION 'FAIL: duplicate alight accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
    VALUES('50000000-0000-4000-8000-000000000006',
      '30000000-0000-4000-8000-000000000001',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '40000000-0000-4000-8000-000000000001','board',now(),true);
    RAISE EXCEPTION 'FAIL: driver pointage accepted with attendant present';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
    VALUES('50000000-0000-4000-8000-000000000007',
      '30000000-0000-4000-8000-000000000001',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '66666666-6666-4666-8666-666666666666',
      '40000000-0000-4000-8000-000000000002','board',now(),true);
    RAISE EXCEPTION 'FAIL: wrong route stop accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested)
    VALUES('50000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '77777777-7777-4777-8777-777777777777',
      '40000000-0000-4000-8000-000000000002','alight',now(),true);
    RAISE EXCEPTION 'FAIL: duplicate event ID accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $assert$;

SELECT (floor(extract(epoch FROM clock_timestamp()))::bigint+90)::text AS expiry \gset
SELECT
  encode(hmac(convert_to(:'att_a'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS att_a_proof,
  encode(hmac(convert_to(:'att_b'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS att_b_proof,
  encode(hmac(convert_to(:'parent_a'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS parent_a_proof
FROM bus_v3_rls.signing_keys WHERE id=1 \gset
SET LOCAL ROLE bus_v3_reader;
DO $assert$
BEGIN
  IF has_table_privilege('bus_v3_reader','public.trip_student_events','INSERT') OR
     has_table_privilege('bus_v3_reader','public.trip_student_events','UPDATE') OR
     has_table_privilege('bus_v3_reader','public.trip_solo_authorizations','SELECT') OR
     has_column_privilege('bus_v3_reader','public.trip_student_events','actor_user_id','SELECT') THEN
    RAISE EXCEPTION 'FAIL: reader gained write rights or solo secret read';
  END IF;
  IF (SELECT count(*) FROM trips) <> 0 OR (SELECT count(*) FROM trip_student_events) <> 0 THEN
    RAISE EXCEPTION 'FAIL: anonymous actor read crew data';
  END IF;
END $assert$;
SELECT set_config('bus_v3.actor_id',:'att_a',true);
SELECT set_config('bus_v3.actor_exp',:'expiry',true);
SELECT set_config('bus_v3.actor_proof',:'att_a_proof',true);
DO $assert$
BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM trip_students) <> 2 OR
     (SELECT count(*) FROM trip_student_events) <> 3 OR
     (SELECT count(*) FROM students) <> 0 THEN
    RAISE EXCEPTION 'FAIL: attendant A scope';
  END IF;
END $assert$;
SELECT set_config('bus_v3.actor_id',:'att_b',true);
SELECT set_config('bus_v3.actor_proof',:'att_b_proof',true);
DO $assert$
BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM trip_students) <> 1 OR
     (SELECT count(*) FROM trip_student_events) <> 1 THEN
    RAISE EXCEPTION 'FAIL: attendant B isolation';
  END IF;
END $assert$;
SELECT set_config('bus_v3.actor_id',:'parent_a',true);
SELECT set_config('bus_v3.actor_proof',:'parent_a_proof',true);
DO $assert$
BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM trip_students) <> 1 OR
     (SELECT count(*) FROM trip_student_events) <> 2 THEN
    RAISE EXCEPTION 'FAIL: parent sees other child';
  END IF;
END $assert$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: SYNC-02 attendant, driver-alone constraints, pointage transitions, idempotent event IDs, parent isolation.'
