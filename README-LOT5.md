# Bus scolaire V3 — Lot 5 : préparation du staging sur Render

Un PostgreSQL 16 gratuit dédié est créé sur Render. Cette archive ajoute une sonde web Node.js **séparée** du runtime V2. Elle ne touche pas aux API de suivi GPS, ne modifie aucun fichier V2 et n'active pas de nouvelle API métier.

## Contenu

- `staging/handler.js`, `staging/server.js`, `staging/package.json`
- `test/v3-staging.test.js`
- `docs/V3_STAGING_RENDER.md` : guide d'installation et de sécurité

## Tester localement

```sh
node --test test/v3-staging.test.js
node --check staging/server.js
```

Ne pas fusionner la PR V3 et ne pas déployer dans le service V2. Pour la suite, consulter `docs/V3_STAGING_RENDER.md`.
