# Bus scolaire V3 — Lot 3 : identité, API et contrôle d'accès

Ce paquet contient **seulement les nouveaux fichiers** à ajouter à la branche GitHub
`feature/bus-v3-foundations` de `elogisco-243/projet-bus-scolaire`.

## Fichiers

- `src/v3/jwt.js` : contrôle cryptographique des *access tokens* RS256.
- `src/v3/repository.js` : lectures SQL paramétrées avec restriction par organisation.
- `src/v3/api.js` : routes V3 en lecture seule et contrôle applicatif.
- `src/v3/bootstrap.js` : assemblage différé du vérificateur, de l'API et du référentiel.
- `test/v3-jwt.test.js` : tests de signature, expiration et audience.
- `test/v3-api.test.js` : tests HTTP, séparation des écoles, parents et transporteurs.
- `test/v3-auth-integration.test.js` : parcours HTTP avec vrais JWT RS256 et refus des fausses identités.
- `test/v3-bootstrap.test.js` : échec sécurisé en absence de configuration.
- `docs/V3_LOT3_AUTH_API.md` : architecture, procédure de validation et limites.

**Ne pas modifier** `src/server.js`, `package.json`, `main` ou Render pour ce lot.

## Mise en place

Extraire l'archive puis **téléverser son contenu, pas son dossier parent**, à la racine de
`feature/bus-v3-foundations`. Les nouveaux fichiers rejoignent les dossiers `src/v3/`,
`test/` et `docs/` déjà existants. Les fichiers des lots 1 et 2 doivent rester en place.

Commit proposé : `Add V3 authentication and read-only API foundations`.

La CI existante doit lancer `npm test` automatiquement. Vérifier le résultat puis garder
la PR n°2 en **Draft**. Ce lot n'est pas un backend prêt à déployer : il faut encore
un fournisseur d'identité, PostgreSQL en staging, les politiques RLS et des tests réels.
