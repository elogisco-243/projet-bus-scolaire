import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthPrototype} from '../mobile-session23/auth-prototype.mjs';
const principal={id:'D-1',source:'trusted_gateway',active:true,role:'driver',organizationId:'S-1',assignedTripIds:['T-1']};
const proof={testOnly:true,verifiedByTrustedGateway:true};
const resource={organizationId:'S-1',tripId:'T-1'};
test('UI173/01 no mock upstream proof rejects session issuance',()=>{
 const s=createAuthPrototype();
 assert.equal(s.issue({principal}).code,'UPSTREAM_REQUIRED');
});
test('UI173/02 issued opaque token authorizes scoped trip',()=>{
 const s=createAuthPrototype(),r=s.issue({principal,upstreamProof:proof});
 assert.match(r.token,/^[0-9a-f]{64}$/);
 assert.equal(s.authorize(r.token,'trip.start',resource).ok,true);
 assert.equal(s.authorize(r.token,'trip.start',{organizationId:'S-2',tripId:'T-1'}).code,'SCOPE_DENIED');
});
test('UI173/03 revocation immediately blocks actions',()=>{
 const s=createAuthPrototype(),r=s.issue({principal,upstreamProof:proof});
 assert.equal(s.revoke(r.token).ok,true);
 assert.equal(s.authorize(r.token,'trip.start',resource).code,'REVOKED_SESSION');
});
test('UI173/04 clock expiry blocks access',()=>{
 let now=0;const s=createAuthPrototype({clock:()=>now,ttlMs:1000});
 const r=s.issue({principal,upstreamProof:proof});
 now=1000;
 assert.equal(s.authenticate(r.token).code,'EXPIRED_SESSION');
});
test('UI173/05 unauthorized role and invalid tokens rejected',()=>{
 const s=createAuthPrototype(),r=s.issue({principal,upstreamProof:proof});
 assert.equal(s.authorize(r.token,'change.review',resource).code,'ROLE_DENIED');
 assert.equal(s.authenticate('bad').code,'INVALID_SESSION');
});
test('UI173/06 audit excludes access token',()=>{
 const s=createAuthPrototype(),r=s.issue({principal,upstreamProof:proof});
 s.authorize(r.token,'trip.start',resource);
 assert.ok(s.audit().length>=2);
 assert.equal(JSON.stringify(s.audit()).includes(r.token),false);
});
test.todo('UI173/REAL: real cryptographic identity provider and server-side gateway');
test.todo('UI173/REAL: persistent revocation and tamper-evident audit storage');
test.todo('UI173/REAL: integration with deployed role-specific Android apps');
