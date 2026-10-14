'use strict';

const { URL } = require('node:url');

function writeJson(response, status, data) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  response.end(JSON.stringify(data));
}

/**
 * Strictement un point d'entrée de staging : aucune donnée métier exposée.
 * Le serveur V3 complet sera monté ici uniquement après identité OIDC, rôle SQL
 * non privilégié, tests RLS sous l'identité Render et audit de sécurité.
 */
function createStagingHandler({ probe } = {}) {
  if (typeof probe !== 'function') throw new TypeError('Database probe required');
  return async (request, response) => {
    let path;
    try {
      path = new URL(request.url, 'http://localhost').pathname;
    } catch {
      return writeJson(response, 400, { error: 'BAD_REQUEST' });
    }
    if (request.method !== 'GET') {
      return writeJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    }
    if (path === '/health') {
      return writeJson(response, 200, {
        status: 'ok', service: 'bus-v3-staging', version: '3.0.0-staging',
        apiEnabled: false
      });
    }
    if (path === '/ready') {
      try {
        const checks = await probe();
        const databaseConnected = checks?.databaseConnected === true;
        const migrationsPresent = checks?.migrationsPresent === true;
        const policiesPresent = checks?.policiesPresent === true;
        const infraReady = databaseConnected && migrationsPresent && policiesPresent;
        return writeJson(response, infraReady ? 200 : 503, {
          status: infraReady ? 'infrastructure_ready' : 'not_ready',
          databaseConnected, migrationsPresent, policiesPresent, apiEnabled: false
        });
      } catch {
        // Ne jamais renvoyer d'URL PostgreSQL, détail de connexion ou exception.
        return writeJson(response, 503, { status: 'not_ready', apiEnabled: false });
      }
    }
    if (path === '/api/v3' || path.startsWith('/api/v3/')) {
      return writeJson(response, 503, { error: 'STAGING_API_DISABLED' });
    }
    return writeJson(response, 404, { error: 'NOT_FOUND' });
  };
}

module.exports = { createStagingHandler };
