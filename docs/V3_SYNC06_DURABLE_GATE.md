# A2S Scola — SYNC-06 : atomic mobile storage boundary and verified bindings

**Isolation: no Android UI-145 integration, no Render deploy, no production API enablement.**

SYNC-06 introduces a strict *interface* for future native encrypted SQLite. It is **not an encryption implementation**. A JavaScript handshake describing encrypted storage cannot independently establish that a device actually encrypts data: that must be implemented and audited in Kotlin/Android, with Android Keystore key management, backup exclusions, key recovery, and lifecycle tests.

The required injected native bridge provides four methods: `inspect()` (version 1, provider native_encrypted_sqlite, atomicRevision true, deviceWideLease true, locked false), `withExclusiveLease(partition, asyncCallback)` (lease must be OS-wide and cover the callback), `read(partition)` (revision and items), and `compareAndSwap(partition,expectedRevision,nextItems)` (durable single-transaction commit returning the next revision). A native plugin must implement these guarantees. Do not simulate them in production with localStorage or an in-memory map.

A session partitions the storage by verified opaque actor, school, operator and trip UUID. `mode` must be `staging`. The queue cannot rewrite event identities, payload fields or change accepted states back to pending, and duplicate queue IDs are refused. All events are retained until a future independently audited retention/purge policy is available.

`createSync06AuthorizedTransport` re-checks each queued pointage against an **authenticated server-provided** short-lived assignment of actor, school, operator, trip, student and stop UUIDs. The client must never manufacture this response from a login form, browser localStorage or UI-145 demo data; the future OIDC-backed server endpoint remains to be built. No automatic remapping or upload of demonstration history is allowed. Server SQL authorization remains final.

Failures: with no native encrypted bridge, invalid binding, expired assignment, CAS conflict or mismatched tenant, the gate fails closed. Network outage or lost ACK leaves original UUID pending for idempotent replay. Invalid alert and stop-arrival events are retained and not sent to the pointage endpoint. `sequenceNo` is per child, not a global synchronization cursor.

Before staging device trials: implement Android-native encrypted SQLite (Keystore + tested transactional CAS and OS-wide lease), provision signed OIDC user/assignment API, ensure per-trip authorization and revocations, implement physical stop attestation, review privacy/retention for minors and the managed Render DB role, test two physical phones with synthetic records. Staging credentials and URLs must not be hard-coded.