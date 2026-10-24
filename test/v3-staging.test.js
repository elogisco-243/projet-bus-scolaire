'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createStagingHandler } = require('../staging/handler');

async function run(handler, path, method = 'GET') {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}${path}`;
    const r = await fetch(url, { method, signal: AbortSignal.timeout(1500) });
    return { status: r.status, body: await r.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health does not advertise access to sensitive endpoints', async () => {
  const res = await run(createStagingHandler({probe:async()=>({})}), '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.apiEnabled, false);
  assert.equal(res.body.service, 'bus-v3-staging');
});

test('readiness fails closed with missing schema, RLS or connection', async () => {
  const paths = [
    {databaseConnected:false,migrationsPresent:false,policiesPresent:false},
    {databaseConnected:true,migrationsPresent:false,policiesPresent:false},
    {databaseConnected:true,migrationsPresent:true,policiesPresent:false}
  ];
  for (const checks of paths) {
    const res = await run(createStagingHandler({probe:async()=>checks}), '/ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.apiEnabled, false);
  }
});

test('readiness reports complete infra but keeps API off', async () => {
  const res = await run(createStagingHandler({probe:async()=>({
    databaseConnected:true,migrationsPresent:true,policiesPresent:true
  })}), '/ready');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'infrastructure_ready');
  assert.equal(res.body.apiEnabled, false);
});

test('readiness never leaks database connection errors', async () => {
  const res = await run(createStagingHandler({probe:async()=>{
    throw Error('password=never-expose-me');
  }}), '/ready');
  assert.equal(res.status, 503);
  assert.equal(JSON.stringify(res.body).includes('never-expose-me'), false);
});

test('all V3 data endpoints are unavailable in staging probe', async () => {
  const handler = createStagingHandler({probe:async()=>({})});
  for (const path of ['/api/v3/me', '/api/v3/trips', '/api/v3/vehicles']) {
    const res = await run(handler, path);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, {error:'STAGING_API_DISABLED'});
  }
  assert.equal((await run(handler, '/health', 'POST')).status, 405);
  assert.equal((await run(handler, '/private')).status, 404);
});
