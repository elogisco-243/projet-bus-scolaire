-- SYNC-04 disposable CI setup ONLY. Requires 001..005 + 004 synthetic seed.
-- Never run against any live database; all credentials are CI-only.
CREATE ROLE sync04_ci_login LOGIN PASSWORD 'ci-only-writer-password' NOINHERIT NOBYPASSRLS;
GRANT bus_v3_writer TO sync04_ci_login WITH INHERIT FALSE, SET TRUE;
-- Explicit short-lived server-admin attestation for fictitious trip.
-- This is NOT physical proof of immobilization.
INSERT INTO public.trip_pointage_context(
 trip_id,current_stop_id,parked_confirmed_at,parked_valid_until,attested_by_user_id
) VALUES (
 '44444444-4444-4444-8444-444444444444',
 '88888888-8888-4888-8888-888888888888',
 clock_timestamp(),clock_timestamp()+interval '4 minutes',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
