# SYNC-03 — PostgreSQL RLS reader (CI-only candidate)

**NOT deployed / NOT mounted in Render. V2 and UI-145 unchanged.**

The identity provider must issue two signed values: JWT `sub` (stable identity subject) and server-controlled `actor_id` (the matching `public.users.id` UUID). A user must never control `actor_id`. The JWT verifier validates these signed claims; the reader refuses tokens without `actor_id`. The reader verifies UUID AND subject against the same active DB account.

Each query uses `withRlsActorTransaction` with 90-second signed actor HMAC, `BEGIN READ ONLY`, `SET LOCAL ROLE bus_v3_reader`, and a verified `current_user` role. All queries use parameters. A separate restricted DB login with role-setting privileges is mandatory; application credentials must not own data tables or bypass RLS.

The per-trip snapshot refreshes membership and verified parent links in the same read-only transaction; the HTTP projection limits parent responses to linked children and excludes route stops. Attendance states are based on the latest authorized ledger action. **Stop arrival is not yet persisted**: `reached:false` is a placeholder, not evidence that a stop was or was not reached.

Before deployment: test using a disposable PostgreSQL 16 instance and real RLS grants; check SECURITY DEFINER/FORCE RLS under the managed Render role, audit issuance/revocation of signed actor_id, session and token expiry, privacy, rate limiting, pagination and test identities. No writer role or sync endpoint is enabled.