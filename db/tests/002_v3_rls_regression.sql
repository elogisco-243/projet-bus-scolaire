-- Tests de RLS sur une DB GitHub Actions jetable. Ne pas exécuter en production.
-- Attend 001_v3_core.sql, 002_v3_integrity.sql, 003_v3_rls.sql.
\set ON_ERROR_STOP on
\set school_a '11111111-1111-4111-8111-111111111111'
\set school_b '22222222-2222-4222-8222-222222222222'
\set operator_a '33333333-3333-4333-8333-333333333333'
\set operator_b '44444444-4444-4444-8444-444444444444'
\set parent_a '55555555-5555-4555-8555-555555555555'
\set parent_b '66666666-6666-4666-8666-666666666666'
\set operator_admin '77777777-7777-4777-8777-777777777777'
\set school_admin '88888888-8888-4888-8888-888888888888'
\set driver_a '99999999-9999-4999-8999-999999999999'
\set driver_b 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set child_a 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set child_b 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set bus_a 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set bus_b 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set route_a '12345678-0000-4000-8000-000000000001'
\set route_b '12345678-0000-4000-8000-000000000002'
\set trip_a 'abcdefab-0000-4000-8000-000000000001'
\set trip_b 'abcdefab-0000-4000-8000-000000000002'

BEGIN;
INSERT INTO bus_v3_rls.signing_keys(id,secret) VALUES (1,gen_random_bytes(32));
INSERT INTO organizations(id,kind,name) VALUES
  (:'school_a','school','École A'),(:'school_b','school','École B'),
  (:'operator_a','operator','Transporteur A'),(:'operator_b','operator','Transporteur B');
INSERT INTO users(id,identity_subject) VALUES
  (:'parent_a','parent-rls-a'),(:'parent_b','parent-rls-b'),
  (:'operator_admin','operator-rls-a'),(:'school_admin','school-rls-a'),
  (:'driver_a','driver-rls-a'),(:'driver_b','driver-rls-b');
INSERT INTO organization_memberships(organization_id,user_id,role) VALUES
  (:'school_a',:'parent_a','parent'),(:'school_b',:'parent_b','parent'),
  (:'operator_a',:'operator_admin','operator_admin'),
  (:'school_a',:'school_admin','school_admin'),
  (:'operator_a',:'driver_a','driver'),(:'operator_b',:'driver_b','driver');
INSERT INTO school_operator_agreements(school_id,operator_id,status) VALUES
  (:'school_a',:'operator_a','active'),(:'school_b',:'operator_b','active');
INSERT INTO students(id,school_id,school_student_ref) VALUES
  (:'child_a',:'school_a','A-001'),(:'child_b',:'school_b','B-001');
INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
  VALUES (:'parent_a',:'child_a',now(),:'school_admin');
-- Pour B, ajouter un admin scolaire valide fictif, différent de celui de l'école A.
INSERT INTO users(id,identity_subject) VALUES ('feedbeef-0000-4000-8000-000000000002','school-rls-b');
INSERT INTO organization_memberships(organization_id,user_id,role)
  VALUES (:'school_b','feedbeef-0000-4000-8000-000000000002','school_admin');
INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
  VALUES (:'parent_b',:'child_b',now(),'feedbeef-0000-4000-8000-000000000002');
INSERT INTO vehicles(id,operator_id,fleet_code,seat_capacity) VALUES
  (:'bus_a',:'operator_a','BUS-A',20),(:'bus_b',:'operator_b','BUS-B',20);
INSERT INTO routes(id,school_id,operator_id,route_code) VALUES
  (:'route_a',:'school_a',:'operator_a','A-01'),(:'route_b',:'school_b',:'operator_b','B-01');
INSERT INTO route_stops(route_id,sequence_no,label,latitude,longitude) VALUES
  (:'route_a',1,'Stop A',-11.66,27.48),(:'route_b',1,'Stop B',-11.67,27.49);
INSERT INTO trips(id,route_id,vehicle_id,driver_user_id,status,school_id,operator_id,scheduled_start_at) VALUES
  (:'trip_a',:'route_a',:'bus_a',:'driver_a','in_progress',:'school_a',:'operator_a',now()),
  (:'trip_b',:'route_b',:'bus_b',:'driver_b','in_progress',:'school_b',:'operator_b',now());
INSERT INTO trip_students(trip_id,student_id,school_id) VALUES
  (:'trip_a',:'child_a',:'school_a'),(:'trip_b',:'child_b',:'school_b');

-- Signature créée par l'administrateur TEST. Le rôle API n'a pas accès à la clé.
SELECT (floor(extract(epoch FROM clock_timestamp()))::bigint+90)::text AS expiry \gset
SELECT
 encode(hmac(convert_to(:'parent_a'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS parent_a_proof,
 encode(hmac(convert_to(:'parent_b'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS parent_b_proof,
 encode(hmac(convert_to(:'operator_admin'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS operator_admin_proof,
 encode(hmac(convert_to(:'school_admin'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS school_admin_proof,
 encode(hmac(convert_to(:'driver_a'||':'||:'expiry','UTF8'),secret,'sha256'),'hex') AS driver_a_proof
 FROM bus_v3_rls.signing_keys WHERE id=1 \gset

SET LOCAL ROLE bus_v3_reader;
DO $assert$
BEGIN
  IF (SELECT count(*) FROM trips) <> 0 OR (SELECT count(*) FROM students) <> 0 THEN
    RAISE EXCEPTION 'FAIL: accès sans attestation HMAC';
  END IF;
  IF has_table_privilege('bus_v3_reader','public.trips','INSERT') OR
     has_table_privilege('bus_v3_reader','public.audit_events','SELECT') OR
     has_table_privilege('bus_v3_reader','bus_v3_rls.signing_keys','SELECT') THEN
    RAISE EXCEPTION 'FAIL: privilèges excessifs';
  END IF;
END $assert$;

SELECT set_config('bus_v3.actor_id',:'parent_a',true);
SELECT set_config('bus_v3.actor_exp',:'expiry',true);
SELECT set_config('bus_v3.actor_proof',:'parent_a_proof',true);
DO $assert$
BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM trips WHERE id='abcdefab-0000-4000-8000-000000000001') <> 1 OR
     (SELECT count(*) FROM students) <> 1 OR
     (SELECT count(*) FROM trip_students) <> 1 OR
     (SELECT count(*) FROM verified_parent_student_links) <> 1 OR
     (SELECT count(*) FROM vehicles) <> 0 OR
     (SELECT count(*) FROM routes) <> 1 OR
     (SELECT count(*) FROM route_stops) <> 1 THEN
    RAISE EXCEPTION 'FAIL: visibilité parent A';
  END IF;
END $assert$;

-- Modifier soi-même le GUC actor_id sans son HMAC ne suffit pas.
SELECT set_config('bus_v3.actor_id',:'parent_b',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 0 OR (SELECT count(*) FROM students) <> 0 THEN
    RAISE EXCEPTION 'FAIL: usurpation actor_id par GUC';
  END IF;
END $assert$;
SELECT set_config('bus_v3.actor_id',:'parent_a',true);
SELECT set_config('bus_v3.actor_proof',repeat('0',64),true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 0 THEN
    RAISE EXCEPTION 'FAIL: signature invalide acceptée';
  END IF;
END $assert$;
SELECT set_config('bus_v3.actor_proof',:'parent_a_proof',true);
SELECT set_config('bus_v3.actor_exp','1000000000',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 0 THEN
    RAISE EXCEPTION 'FAIL: signature expirée acceptée';
  END IF;
END $assert$;

SELECT set_config('bus_v3.actor_id',:'parent_b',true);
SELECT set_config('bus_v3.actor_exp',:'expiry',true);
SELECT set_config('bus_v3.actor_proof',:'parent_b_proof',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM trips WHERE id='abcdefab-0000-4000-8000-000000000002') <> 1 OR
     (SELECT count(*) FROM students) <> 1 THEN
    RAISE EXCEPTION 'FAIL: isolation parent B';
  END IF;
END $assert$;

SELECT set_config('bus_v3.actor_id',:'operator_admin',true);
SELECT set_config('bus_v3.actor_proof',:'operator_admin_proof',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM vehicles) <> 1 OR
     (SELECT count(*) FROM students) <> 0 OR
     (SELECT count(*) FROM trip_students) <> 0 THEN
    RAISE EXCEPTION 'FAIL: isolation transporteur A';
  END IF;
END $assert$;

SELECT set_config('bus_v3.actor_id',:'school_admin',true);
SELECT set_config('bus_v3.actor_proof',:'school_admin_proof',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM students) <> 1 OR
     (SELECT count(*) FROM trip_students) <> 1 OR
     (SELECT count(*) FROM vehicles) <> 0 THEN
    RAISE EXCEPTION 'FAIL: isolation école A';
  END IF;
END $assert$;

SELECT set_config('bus_v3.actor_id',:'driver_a',true);
SELECT set_config('bus_v3.actor_proof',:'driver_a_proof',true);
DO $assert$ BEGIN
  IF (SELECT count(*) FROM trips) <> 1 OR
     (SELECT count(*) FROM students) <> 0 OR
     (SELECT count(*) FROM vehicles) <> 0 THEN
    RAISE EXCEPTION 'FAIL: isolation chauffeur A';
  END IF;
END $assert$;

RESET ROLE;
ROLLBACK;
\echo 'PASS: RLS avec attestation HMAC, séparation écoles/transporteurs, rôles sans accès SQL sensible.'
