# Bus scolaire V3 — Lot 4 : RLS PostgreSQL avec identité signée

**Statut : paquet pour la branche `feature/bus-v3-foundations` / PR n° 2 en Draft.** Ne déploie et ne modifie aucun service Render.

## Contenu (6 fichiers)

- `db/migrations/003_v3_rls.sql` : politique de lecture RLS, rôle `bus_v3_reader` à privilèges minimaux, schéma protégé contenant une clé HMAC, fonctions autorisant seulement l'identité attestée. **Aucune clé secrète incluse.**
- `db/tests/002_v3_rls_regression.sql` : données fictives sous `BEGIN` / `ROLLBACK`, tests de lecture école/transporteur/parent/chauffeur, preuve HMAC falsifiée/expirée et accès aux tables secrètes/audit.
- `.github/workflows/v3-rls.yml` : PostgreSQL 16 temporaire et tests de migrations 001 → 002 → 003 et des deux régressions SQL.
- `src/v3/rls-session.js` : helper Node transactionnel, HMAC SHA256 et `SET LOCAL` sans concaténation SQL.
- `test/v3-rls-session.test.js` : tests du helper Node.

**Attention : le SQL n'a pas été exécuté localement faute de moteur PostgreSQL disponible.** La réussite doit être confirmée via GitHub Actions après publication. Les tests Node locaux ne remplacent pas les tests SQL.

## Protocole de signature et limites

Le backend vérifie un JWT OIDC (module lot 3), retrouve un `userId` UUID côté serveur, signe pour une durée de 90 secondes la chaîne UTF-8 `userId:unix_expiry` à l'aide d'un secret HMAC partagé avec la base. Il place l'identité, l'expiration et la preuve en paramètres SQL avec `set_config(..., true)` dans **une seule transaction de lecture** sur la **même connexion**. PostgreSQL recalcule la signature dans `bus_v3_rls.actor_id()` avec sa clé protégée. Les GUC non signées, les signatures falsifiées et les expirations hors fenêtre sont refusées.

L'extension `pgcrypto` est requise. La clé DB doit être provisionnée **hors GitHub** de façon identique à `V3_RLS_SIGNING_SECRET` du service V3 de test (au moins 32 octets). Ne jamais stocker ni publier ce secret dans le dépôt, les captures ou les journaux. Ne jamais exécuter `INSERT ... secret` avec un secret visible en historique shell ou journal CI. Le script de test génère sa clé aléatoire **uniquement dans une transaction jetable**.

Le rôle `bus_v3_reader` est `NOLOGIN`/`NOBYPASSRLS`, n'a pas de droits d'écriture, ni accès aux clés ni à l'audit. Dans le futur, le pool applicatif doit s'authentifier avec un compte autorisé à prendre ce rôle, sans droits supérieurs ; il faudra empêcher une fuite d'un login PostgreSQL privilégié. Un rôle utilisé pour déployer les migrations n'est **pas** le rôle applicatif.

### Bloquants de production

1. Valider les tests SQL réels, puis tester les attaques concurrentes et le passage d'identité entre connexions PostgreSQL.
2. Définir un fournisseur OIDC réel et un **bootstrap de résolution de `sub` vers UUID** sûr ; le module `createV3Repository` du lot 3 n'est pas encore intégré à ce contexte transactionnel. Aucun accès API V3 en production.
3. Établir la procédure de rotation de la clé HMAC et la révocation des droits en temps réel. Les preuves ont une fenêtre de rejeu de 90 secondes : ne pas réutiliser ni journaliser ces preuves.
4. Vérifier les politiques d'accès exactes aux membres de l'école, transporteur et responsables avec des tests fonctionnels et juridiques ; obtenir une revue de sécurité indépendante.
5. Créer une **base et un service Render de staging séparés** uniquement après accord et revue des coûts ; aucune ressource supplémentaire n'est créée avec ce lot.
6. Définir le contrôle de migrations, sauvegardes, privilèges SQL, durées de conservation, journal d'audit et protection des données des mineurs.

Cette migration vise PostgreSQL 16, sous superutilisateur **uniquement en CI jetable**. Pour un hébergeur managé, auditer l'ownership et les privilèges des fonctions `SECURITY DEFINER` ; une exécution avec un propriétaire soumis au RLS ou un propriétaire inattendu demande une adaptation.

## Instructions GitHub

1. Extraire l'archive, copier son **contenu** (pas le dossier parent) à la racine de `feature/bus-v3-foundations`.
2. Si GitHub refuse `.github`, créer `.github/workflows/v3-rls.yml` manuellement depuis son contenu.
3. Commit : `Add V3 signed identity PostgreSQL RLS tests`.
4. Ouvrir Actions : `Bus V3 - PostgreSQL RLS Tests` et vérifier le détail de toutes les étapes. En cas d'échec, **ne pas fusionner** et nous corrigerons les scripts.
5. Conserver la PR n° 2 en **Draft** et la V2 sur `main` / Render inchangée.
