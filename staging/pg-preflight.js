
'use strict';

const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_MISSING');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000
  });

  try {
    const result = await pool.query(`
      SELECT
        current_setting('server_version_num')::integer
          AS postgres_version,
        r.rolsuper AS is_superuser,
        r.rolcreaterole AS can_create_roles,
        r.rolbypassrls AS can_bypass_rls,
        has_database_privilege(
          current_database(), 'CREATE'
        ) AS can_create_schemas,
        has_schema_privilege(
          'public', 'CREATE'
        ) AS can_create_tables,
        EXISTS (
          SELECT 1 FROM pg_available_extensions
          WHERE name = 'pgcrypto'
        ) AS pgcrypto_available
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);

    console.log('V3_POSTGRES_PREFLIGHT');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(
    'PREFLIGHT_FAILED:',
    error.code || 'CONNECTION_ERROR'
  );
  process.exitCode = 1;
});
