# A2S Scola — SYNC-04 : Secure pointage writer (isolated prototype)

**NOT DEPLOYED, NOT MOUNTED, NOT MOBILE-ENABLED.** No changes to Render, V2 `main`, or UI-145.

## Design

- Database migration `005_v3_sync04_writer.sql` creates a `bus_v3_writer` NOLOGIN role with **only EXECUTE** on the isolated pointage function, not table-level read/write.
- That SQL function uses the existing DB-verified signed HMAC identity `bus_v3_rls.actor_id()`, rechecks the active transport organization and crew assignment, and owns the append-only idempotent event operation. The 004 trigger enforces the existing student transitions and allocates `sequence_no`.
- The operations-only `trip_pointage_context` table records a specific current route stop, a named authorized dispatcher/operator administrator and a max 5-minute validity period. There are no application grants to populate that table. **This administrative attestation is NOT physical proof that a bus is stationary**, and a real independent attestation process remains necessary before real children are transported.
- `createSync04WriteApi` validates an RS256 access token through a trusted injected verifier, requires issuer-signed `actor_id`, and resolves the matching active actor/subject via the read adapter. It validates the offline event allowlist and max body size. Identity, role, attestation and sequence are never accepted from client JSON.
- The writer uses `SET LOCAL ROLE bus_v3_writer`, HMAC proof and a parameterized single SQL function in one transaction. No changes are made to the read-only RLS role.
- Receipt codes: `201 recorded`, `200 already_recorded`, `403 NOT_AUTHORIZED`, `409 EVENT_CONFLICT_OR_NOT_READY`, `422 INVALID_EVENT`. The same event ID may only be acknowledged for the same actor, trip, student, stop and timestamp.
- For offline pointages after a bus has moved on, the server rejects new unconfirmed old-stop events rather than silently applying them. Manual reconciliation and queue workflows are future work.

## Before any integration/deployment

- Run synthetic PostgreSQL 16 regression and full HTTP→JWT→writer-role→SQL transaction E2E, including duplicate event, conflict, parent denial, wrong operator, expired parked attestation and parallel events.
- Independent audit of SECURITY DEFINER function owner privilege boundary and FORCE RLS on *managed* PostgreSQL; use a dedicated, non-owner limited DB login with permission only to SET ROLE bus_v3_writer.
- Establish real OIDC issuer, authorized claim assignment/revocation, trustworthy parked attestation (the local bus-stopped checkbox is insufficient), protected secret rotation, rate limiting, audit and retention requirements.
- Only then consider mounting on a staging URL; no Render deployment until separately approved and verified. All tests use fictional children.
