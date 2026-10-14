'use strict';

const { canViewTrip } = require('./authorization');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(value));
}

function readWindow(params) {
  const readInt = (field, defaultValue, max) => {
    const value = params.get(field);
    if (value === null) return defaultValue;
    if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n <= max ? n : null;
  };
  const limit = readInt('limit', 20, 50);
  const offset = readInt('offset', 0, 5000);
  return limit === null || limit === 0 || offset === null ? null : {limit, offset};
}

function publicTrip(trip) {
  return {
    id: trip.id, status: trip.status,
    schoolId: trip.schoolId, operatorId: trip.operatorId,
    routeCode: trip.routeCode,
    scheduledStartAt: trip.scheduledStartAt
  };
}

// Handler HTTP montable sous /api/v3 dans le futur. Aucune route V3 n'est
// inscrite automatiquement dans src/server.js (V2 sur Render inchangée).
function createV3Api({ verifyToken, repository }) {
  if (typeof verifyToken !== 'function' || !repository ||
      !['loadActor','listTripContexts','getTripContext','listVehicles'].every(
        name => typeof repository[name] === 'function')) {
    throw new TypeError('Identite verifiee et depot de donnees V3 requis');
  }
  return async function handleV3Request(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (!route.startsWith('/api/v3/')) return sendJson(res, 404, {error:'NOT_FOUND'});
      if (req.method !== 'GET') return sendJson(res, 405, {error:'METHOD_NOT_ALLOWED'});
      const authorization = req.headers.authorization;
      if (typeof authorization !== 'string' ||
          !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)) {
        return sendJson(res, 401, {error:'UNAUTHORIZED'});
      }
      let identity;
      try { identity = verifyToken(authorization.slice(7)); }
      catch { return sendJson(res, 401, {error:'UNAUTHORIZED'}); }
      if (!identity || typeof identity.subject !== 'string') {
        return sendJson(res, 401, {error:'UNAUTHORIZED'});
      }
      const actor = await repository.loadActor(identity.subject);
      if (!actor || !actor.userId) return sendJson(res, 401, {error:'UNAUTHORIZED'});

      if (route === '/api/v3/me') {
        return sendJson(res, 200, {
          userId: actor.userId,
          memberships: actor.memberships.filter(m => m.active === true).map(m => ({
            role: m.role, organizationId: m.organizationId
          }))
        });
      }
      if (route === '/api/v3/trips') {
        const window = readWindow(url.searchParams);
        if (!window) return sendJson(res, 400, {error:'INVALID_PAGINATION'});
        const rows = await repository.listTripContexts(actor, window.limit, window.offset);
        const hasMore = rows.length > window.limit;
        const items = rows.slice(0, window.limit).filter(ctx => canViewTrip(actor,ctx))
          .map(ctx => publicTrip(ctx.trip));
        return sendJson(res, 200, {
          items, nextOffset: hasMore ? window.offset + window.limit : null
        });
      }
      const match = /^\/api\/v3\/trips\/([^/]+)$/.exec(route);
      if (match) {
        if (!UUID.test(match[1])) return sendJson(res, 400, {error:'INVALID_TRIP_ID'});
        const ctx = await repository.getTripContext(match[1]);
        if (!ctx || !canViewTrip(actor, ctx)) return sendJson(res, 404, {error:'NOT_FOUND'});
        return sendJson(res, 200, {trip: publicTrip(ctx.trip)});
      }
      if (route === '/api/v3/vehicles') {
        const canReadFleet = actor.memberships.some(m => m.active === true &&
          (m.role === 'operator_admin' || m.role === 'dispatcher'));
        if (!canReadFleet) return sendJson(res, 403, {error:'FORBIDDEN'});
        const window = readWindow(url.searchParams);
        if (!window) return sendJson(res, 400, {error:'INVALID_PAGINATION'});
        const rows = await repository.listVehicles(actor, window.limit, window.offset);
        const authorizedOperators = new Set(actor.memberships.filter(m => m.active === true &&
          (m.role === 'operator_admin' || m.role === 'dispatcher')).map(m => m.organizationId));
        return sendJson(res, 200, {
          items: rows.slice(0, window.limit).filter(v => authorizedOperators.has(v.operatorId))
            .map(v => ({id:v.id,operatorId:v.operatorId,fleetCode:v.fleetCode,
                        seatCapacity:v.seatCapacity,active:v.active})),
          nextOffset: rows.length > window.limit ? window.offset + window.limit : null
        });
      }
      return sendJson(res, 404, {error:'NOT_FOUND'});
    } catch (error) {
      // L'exception est journalisee uniquement par un observateur serveur futur.
      // Ne jamais exposer requetes SQL, jetons, stacktrace ou identite au client.
      return sendJson(res, 500, {error:'INTERNAL_ERROR'});
    }
  };
}

module.exports = { createV3Api, readWindow };
