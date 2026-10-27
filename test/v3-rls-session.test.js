'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { createActorProof, withRlsActorTransaction } = require('../src/v3/rls-session');
const actor = '55555555-5555-4555-8555-555555555555';
const secret = 'ab'.repeat(32);

test('preuve HMAC reproductible et valable 90 secondes', () => {
  const proof = createActorProof(actor, secret, 1_760_000_000_000);
  assert.equal(proof.expiry, '1760000090');
  assert.equal(proof.proof, createHmac('sha256',Buffer.from(secret,'hex'))
    .update(`${actor}:${proof.expiry}`).digest('hex'));
  assert.equal(proof.proof.length, 64);
});

test('rejette identifiants et secrets invalides', () => {
  assert.throws(() => createActorProof('parent-from-browser',secret));
  assert.throws(() => createActorProof(actor,'password'));
  assert.throws(() => createActorProof(actor,'ff'.repeat(10)));
});

test('une transaction de lecture utilise un seul client et SET LOCAL paramétré', async () => {
  const calls = [];
  let released = false;
  const client = {query: async (...args) => {calls.push(args);return {rows:[{ok:true}]};},
    release: () => {released = true;}};
  const pool = {connect: async () => client};
  const result = await withRlsActorTransaction(pool,actor,secret,async db => {
    assert.equal(db,client);
    return db.query('SELECT 1');
  });
  assert.deepEqual(result.rows,[{ok:true}]);
  assert.equal(released,true);
  assert.equal(calls[0][0],'BEGIN READ ONLY');
  assert.ok(calls[1][0].includes("set_config('bus_v3.actor_proof', $3, true)"));
  assert.equal(calls[1][1][0],actor);
  assert.equal(calls[1][1][2].length,64);
  assert.equal(calls.at(-1)[0],'COMMIT');
});

test('la transaction est annulée et la connexion libérée si la requête échoue', async () => {
  const calls = [];
  let released = false;
  const client = {query: async sql => {
    calls.push(sql);
    if (sql === 'SELECT failed') throw Error('request failed');
    return {rows:[]};
  },release:()=>{released=true;}};
  const pool = {connect: async()=>client};
  await assert.rejects(
    withRlsActorTransaction(pool,actor,secret,db=>db.query('SELECT failed')),
    /request failed/
  );
  assert.deepEqual(calls.filter(x=>['BEGIN READ ONLY','SELECT failed','ROLLBACK'].includes(x)),
    ['BEGIN READ ONLY','SELECT failed','ROLLBACK']);
  assert.equal(released,true);
});
