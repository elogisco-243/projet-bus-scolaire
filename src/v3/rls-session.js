'use strict';

// NE PAS activer avec un actorId issu du client : l'identité doit être vérifiée
// par le fournisseur OIDC puis résolue côté serveur avant tout appel.
// Le secret HMAC (32+ octets) doit correspondre à signing_keys.secret (id=1).
const { createHmac } = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createActorProof(actorId, secretHex, now = Date.now()) {
  if (typeof actorId !== 'string' || !UUID.test(actorId)) {
    throw new TypeError('actorId PostgreSQL UUID requis (identité vérifiée côté serveur)');
  }
  if (typeof secretHex !== 'string' || !/^[0-9a-f]{64,}$/i.test(secretHex) ||
      secretHex.length % 2 !== 0 || !Number.isFinite(now)) {
    throw new TypeError('V3_RLS_SIGNING_SECRET : secret hexadécimal valide de 32 octets minimum requis');
  }
  const normalizedActorId = actorId.toLowerCase();
  const expiry = String(Math.floor(now / 1000) + 90);
  const proof = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`${normalizedActorId}:${expiry}`, 'utf8').digest('hex');
  return { actorId: normalizedActorId, expiry, proof };
}

async function withRlsActorTransaction(pool, actorId, secretHex, run) {
  if (!pool || typeof pool.connect !== 'function' || typeof run !== 'function') {
    throw new TypeError('Pool PostgreSQL et callback requis');
  }
  const context = createActorProof(actorId, secretHex);
  const client = await pool.connect();
  let begun = false;
  try {
    await client.query('BEGIN READ ONLY');
    begun = true;
    // SET LOCAL ne s'applique qu'à CETTE transaction / CETTE connexion.
    await client.query(`SELECT
      set_config('bus_v3.actor_id', $1, true),
      set_config('bus_v3.actor_exp', $2, true),
      set_config('bus_v3.actor_proof', $3, true)`,
    [context.actorId, context.expiry, context.proof]);
    const result = await run(client);
    await client.query('COMMIT');
    begun = false;
    return result;
  } catch (error) {
    if (begun) {
      try { await client.query('ROLLBACK'); } catch { /* erreur d'origine préservée */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createActorProof, withRlsActorTransaction };
