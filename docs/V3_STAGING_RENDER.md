# Bus scolaire V3 — Environnement de test Render

## État au 14 octobre 2026

- **Render PostgreSQL 16 de test créé** : `bus-scolaire-v3-staging-db`, en région `virginia`, plan `free`.
- **ID Render** : `dpg-db7qthaj9qps73de7rjg-a`.
- **Expiration prévue** : 13 novembre 2026. Ne pas stocker de données uniques ou réelles dans ce service gratuit.
- **Aucune migration SQL exécutée** dans cette base à ce stade.
- **Le service Render V2** `bus-scolaire-backend` reste sur `main` (commit `b2261b6`), sans changement.
- **Le service web V3 de staging n'est pas encore créé** : il nécessite la publication de ce paquet sur GitHub et une configuration séparée.

## Fichiers du lot 5

- `staging/handler.js` : `/health`, `/ready`, et refus des requêtes d'API V3.
- `staging/server.js` : serveur autonome avec vérification de disponibilité PostgreSQL, uniquement sur catalogue SQL.
- `staging/package.json` : dépendance `pg` isolée des dépendances V2.
- `test/v3-staging.test.js` : 5 tests Node.js, aucune base nécessaire.

## Publication du code

1. Sur GitHub sélectionner `feature/bus-v3-foundations` (pull request n° 2 toujours en **Draft**).
2. Déposer le contenu du ZIP à la racine, sans écraser les fichiers V2.
3. Faire un commit `Add isolated Render V3 staging probe`.
4. Vérifier le workflow existant `Bus v2 tests` (la commande `npm test` découvre `test/v3-staging.test.js`).
5. Ne pas fusionner avec `main` et ne pas changer le service Render V2.

## Configuration du futur service Render V3

Créer **uniquement après publication du paquet et tests GitHub verts** un service web séparé :

- Name : `bus-scolaire-v3-staging`
- Repo : `https://github.com/elogisco-243/projet-bus-scolaire`
- Branch : `feature/bus-v3-foundations`
- Region : `virginia` (même région que la base)
- Runtime : `node`
- Plan : `free` (si disponible)
- Auto deploy : `no` initialement, afin de maîtriser la mise à jour de l'instance de test
- Build command : `npm install --prefix staging --no-audit --no-fund`
- Start command : `node staging/server.js`
- Health check path : `/health`
- Environment : `HOST=0.0.0.0`, et laisser `PORT` à Render.

**Ne pas ajouter tout de suite `DATABASE_URL`** : en premier lieu, vérifier que `/health` répond et `/ready` reste indisponible (503). La base fraîchement créée est vide, donc `/ready` restera 503 même après raccordement jusqu'à la validation des migrations.

## Connexion base de test : étape suivante

La base a une liste blanche d'adresses IP externes vide. C'est un comportement sûr ; ne pas l'ouvrir à `0.0.0.0/0` pour permettre l'accès ChatGPT. La connexion depuis un service Render de la même région utilisera **l'URL interne** affichée dans le tableau de bord Render, ajoutée comme variable d'environnement du **service V3 uniquement** et jamais dans GitHub, les logs ou cette conversation.

La commande native Render de requête Postgres depuis ChatGPT ne permet que la lecture, et la liste blanche actuelle bloque l'accès externe. Les migrations `001`, `002` et `003` **ne sont donc pas encore appliquées à la base Render**. Ne jamais prétendre le contraire sur la base des seuls tests GitHub Actions, qui utilisent des conteneurs éphémères.

Avant d'activer des API métier : exécuter les migrations avec un accès de migration dédié; préparer et contrôler le rôle SQL non privilégié, les fonctions RLS en PostgreSQL managé, le fournisseur OIDC, les secrets et les tests bout en bout. La migration actuelle a été testée en GitHub Actions sous compte PostgreSQL de CI : son comportement exact avec le propriétaire PostgreSQL managé doit être revu, notamment les fonctions `SECURITY DEFINER` et `FORCE ROW LEVEL SECURITY`.

## Contrat des endpoints de la sonde

- `GET /health` : 200, application de staging démarrée, **API métier inactive**.
- `GET /ready` : 200 uniquement lorsque connexion DB, tables et politique RLS sont détectées; **API métier reste inactive**. Sinon 503.
- `GET /api/v3/*` : toujours **503 STAGING_API_DISABLED**.

Ce lot **n'implémente pas encore** la connexion OIDC ou des opérations sur des trajets réels. Ne pas charger de vrais comptes ou données d'enfants en staging.
