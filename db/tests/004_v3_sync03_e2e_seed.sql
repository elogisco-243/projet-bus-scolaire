-- SYNC-03: synthetic CI fixtures ONLY. Never run on Render or any live DB.
-- PostgreSQL 16 disposable runner; passwords and signing key are CI-only literals.
CREATE ROLE sync03_ci_login LOGIN PASSWORD 'ci-only-reader-password' NOINHERIT NOBYPASSRLS;
GRANT bus_v3_reader TO sync03_ci_login WITH INHERIT FALSE, SET TRUE;
BEGIN;
INSERT INTO bus_v3_rls.signing_keys(id,secret) VALUES(1,decode(repeat('ab',32),'hex'));
INSERT INTO organizations(id,kind,name) VALUES
('22222222-2222-4222-8222-222222222222','school','Test school'),
('33333333-3333-4333-8333-333333333333','operator','Test operator');
INSERT INTO users(id,identity_subject) VALUES
('11111111-1111-4111-8111-111111111111','ci:parent'),
('55555555-5555-4555-8555-555555555555','ci:driver'),
('99999999-9999-4999-8999-999999999999','ci:attendant'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ci:operator-admin'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ci:school-admin');
INSERT INTO organization_memberships(organization_id,user_id,role) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','parent'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','school_admin'),
('33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','driver'),
('33333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','attendant'),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','operator_admin');
INSERT INTO school_operator_agreements(school_id,operator_id,status) VALUES
('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','active');
INSERT INTO students(id,school_id,school_student_ref) VALUES
('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','CI-A'),
('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','CI-B');
INSERT INTO verified_parent_student_links(parent_user_id,student_id,verified_at,verified_by_user_id)
VALUES('11111111-1111-4111-8111-111111111111',
'66666666-6666-4666-8666-666666666666',now(),
'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO vehicles(id,operator_id,fleet_code,seat_capacity) VALUES
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','CI-BUS',20);
INSERT INTO routes(id,school_id,operator_id,route_code) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333','CI-ROUTE');
INSERT INTO route_stops(id,route_id,sequence_no,label,latitude,longitude) VALUES
('88888888-8888-4888-8888-888888888888','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,'CI Stop',-1.66,29.22);
INSERT INTO trips(id,route_id,vehicle_id,driver_user_id,status,school_id,operator_id,scheduled_start_at) VALUES
('44444444-4444-4444-8444-444444444444',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '55555555-5555-4555-8555-555555555555',
 'in_progress',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',now());
INSERT INTO trip_students(trip_id,student_id,school_id) VALUES
('44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666',
 '22222222-2222-4222-8222-222222222222'),
('44444444-4444-4444-8444-444444444444',
 '77777777-7777-4777-8777-777777777777',
 '22222222-2222-4222-8222-222222222222');
INSERT INTO trip_attendants(trip_id,attendant_user_id,assigned_by_user_id) VALUES
('44444444-4444-4444-8444-444444444444',
 '99999999-9999-4999-8999-999999999999',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO trip_student_events(event_id,trip_id,student_id,actor_user_id,stop_id,action,occurred_at,parked_attested) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666',
 '99999999-9999-4999-8999-999999999999',
 '88888888-8888-4888-8888-888888888888','board',now(),true),
('ffffffff-ffff-4fff-8fff-ffffffffffff',
 '44444444-4444-4444-8444-444444444444',
 '77777777-7777-4777-8777-777777777777',
 '99999999-9999-4999-8999-999999999999',
 '88888888-8888-4888-8888-888888888888','board',now(),true);
COMMIT;
