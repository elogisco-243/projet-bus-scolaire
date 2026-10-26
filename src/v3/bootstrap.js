'use strict';
const { createJwtVerifier } = require('./jwt');
const { createV3Repository } = require('./repository');
const { createV3Api } = require('./api');

// À utiliser UNIQUEMENT sur un serveur V3 de test avec un pool PostgreSQL
// en lecture seule et un fournisseur OIDC externe déjà configuré.
function createConfiguredV3Api({ env = process.env, db }) {
  const verifyToken = createJwtVerifier({
    issuer: env.V3_JWT_ISSUER,
    audience: env.V3_JWT_AUDIENCE,
    publicKeyPem: env.V3_JWT_PUBLIC_KEY_PEM,
    keyId: env.V3_JWT_KEY_ID || undefined
  });
  return createV3Api({ verifyToken, repository: createV3Repository(db) });
}
module.exports = { createConfiguredV3Api };
