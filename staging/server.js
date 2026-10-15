'use strict';

const http = require('node:http');
const { createStagingHandler } = require('./handler');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT invalide');
}

let pool;
if (process.env.DATABASE_URL) {
  // Installation exclusivement pour le service de staging : npm install --prefix staging
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 4000,
    application_name: 'bus-v3-staging-probe'
  });
}

async function probe() {
  if (!pool) return { databaseConnected: false, migrationsPresent: false, policiesPresent: false };
  // Metadata uniquement : aucune lecture des enfants, des trajets ou des secrets.
  const result = await pool.query(`
    SELECT
      (to_regclass('public.organizations') IS NOT NULL
       AND to_regclass('public.trips') IS NOT NULL
       AND to_regclass('bus_v3_rls.signing_keys') IS NOT NULL) AS migrations_present,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname='public' AND tablename='trips' AND policyname='v3_trips_read'
      ) AS policies_present
  `);
  return {
    databaseConnected: true,
    migrationsPresent: result.rows[0]?.migrations_present === true,
    policiesPresent: result.rows[0]?.policies_present === true
  };
}

const server = http.createServer(createStagingHandler({ probe }));
server.listen(port, host, () => {
  console.log('Bus V3 staging ready to probe on port ' + port + '; business API disabled.');
});
async function stop() {
  server.close();
  if (pool) await pool.end();
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
