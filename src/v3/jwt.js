'use strict';

// Vérification locale RS256 avec clé publique épinglée. Les jetons sont délivrés
// par un fournisseur d'identité externe, jamais par ce module.
const { createPublicKey, verify } = require('node:crypto');

class InvalidTokenError extends Error {
  constructor() { super('INVALID_TOKEN'); this.name = 'InvalidTokenError'; }
}

function decodePart(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new InvalidTokenError();
  }
  const result = Buffer.from(value, 'base64url');
  if (result.toString('base64url') !== value) throw new InvalidTokenError();
  return result;
}

function objectPart(value) {
  try {
    const parsed = JSON.parse(decodePart(value).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new InvalidTokenError(); }
}

function createJwtVerifier({ issuer, audience, publicKeyPem, keyId, now = Date.now,
                             maxLifetimeSeconds = 900, clockSkewSeconds = 30, expectedTokenType = 'at+jwt' }) {
  if (typeof issuer !== 'string' || !issuer.startsWith('https://') ||
      typeof audience !== 'string' || !audience.trim() ||
      typeof publicKeyPem !== 'string' || !publicKeyPem.trim()) {
    throw new Error('V3_JWT_ISSUER, V3_JWT_AUDIENCE et V3_JWT_PUBLIC_KEY_PEM sont obligatoires');
  }
  const key = createPublicKey(publicKeyPem.replace(/\\n/g, '\n'));
  if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
    throw new Error('La cle publique doit etre une cle RSA de 2048 bits minimum');
  }
  if (!Number.isInteger(maxLifetimeSeconds) || maxLifetimeSeconds < 1 ||
      !Number.isInteger(clockSkewSeconds) || clockSkewSeconds < 0) {
    throw new Error('Duree de vie JWT incorrecte');
  }

  return function verifyJwt(token) {
    if (typeof token !== 'string' || token.length > 8192) throw new InvalidTokenError();
    const parts = token.split('.');
    if (parts.length !== 3) throw new InvalidTokenError();
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = objectPart(encodedHeader);
    if (header.alg !== 'RS256' || header.typ !== expectedTokenType ||
        header.crit !== undefined || header.jku !== undefined ||
        header.jwk !== undefined || header.x5u !== undefined || header.x5c !== undefined ||
        (keyId ? header.kid !== keyId : header.kid !== undefined)) {
      throw new InvalidTokenError();
    }
    const payload = objectPart(encodedPayload);
    const signature = decodePart(encodedSignature);
    if (!verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), key, signature)) {
      throw new InvalidTokenError();
    }
    const nowSeconds = Math.floor(now() / 1000);
    if (payload.iss !== issuer ||
        !(payload.aud === audience || (Array.isArray(payload.aud) &&
          payload.aud.includes(audience) && payload.aud.every(x => typeof x === 'string'))) ||
        typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 255 ||
        !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
        payload.exp <= payload.iat || payload.exp - payload.iat > maxLifetimeSeconds ||
        payload.exp <= nowSeconds || payload.iat > nowSeconds + clockSkewSeconds ||
        (payload.nbf !== undefined && (!Number.isInteger(payload.nbf) ||
          payload.nbf > nowSeconds + clockSkewSeconds))) {
      throw new InvalidTokenError();
    }
    return { subject: payload.sub };
  };
}

module.exports = { createJwtVerifier, InvalidTokenError };
