# Bus scolaire V3 — Lot 3 : authentification et API (staging uniquement)

**Statut : module de travail, NON connecté à `src/server.js` (V2), NON déployé sur Render.**

## Architecture

- **Jeton d'accès OIDC/JWT** délivré par un fournisseur d'identité externe (non fourni).
- **Signature RSA-SHA256** contrôlée avec une clé publique épinglée côté serveur. Le JWT doit avoir `typ=at+jwt`, `alg=RS256`, `iss`, `aud`, `sub`, `iat`, `exp` valides, durée maximale de **15 minutes** ; clé RSA de **2048 bits minimum**. Un identifiant `kid` devient obligatoire si `V3_JWT_KEY_ID` est défini.
- **Identité applicative** : la revendication `sub` sert uniquement à retrouver `users.identity_subject` en PostgreSQL. Les rôles, appartenances et liens parent–élève sont relus **en base à chaque requête**.
- **Autorisation** : double filtre (requêtes SQL paramétrées par `user_id` ET fonctions V3 d'autorisation JavaScript). Le contexte envoyé par le client n'est jamais utilisé pour accorder un rôle ou lier un enfant.
- **API en lecture seule** : aucune inscription d'enfant, aucune gestion de flotte, aucune émission GPS, aucune modification en base ne sont exposées.

## API proposée

| Route | Fonction | Accès |
|---|---|---|
| `GET /api/v3/me` | Identifiant du compte et rôles actifs par organisation | Compte identifié et actif |
| `GET /api/v3/trips?limit=20&offset=0` | Trajets visibles et pagination plafonnée | École, transporteur, chauffeur affecté, parent vérifié |
| `GET /api/v3/trips/:uuid` | Détail minimal d'un trajet | Même restriction ; 404 si inaccessible |
| `GET /api/v3/vehicles?limit=20&offset=0` | Bus visibles pour un transporteur | Administrateur transporteur ou dispatcher |

Les réponses n'exposent **ni noms d'enfants, ni jetons, ni identifiants d'enfants, ni liste des parents**. Les endpoints d'erreur ne contiennent pas d'informations sensibles.

## Paramètres de configuration V3 (à ne PAS ajouter à Render V2)

- `V3_JWT_ISSUER` : URL HTTPS **exacte** de l'émetteur des *access tokens*.
- `V3_JWT_AUDIENCE` : audience spécifique de l'API Bus scolaire V3.
- `V3_JWT_PUBLIC_KEY_PEM` : clé publique de vérification au format PEM. Ce n'est **pas** une clé privée.
- `V3_JWT_KEY_ID` : identifiant de clé optionnel si les JWT utilisent `kid`.

**Aucun token de test, secret, certificat privé, URL de base réelle, mot de passe ou donnée d'élève ne doit être commité.** Ne pas réutiliser `BUS_ACCESS_TOKENS` de la V2 comme jetons JWT.

## Intégration future dans un serveur V3 dédié

La fonction `createConfiguredV3Api({env,db})` prépare un gestionnaire HTTP. Le paramètre `db` est un pool/une connexion PostgreSQL compatible avec `query(sql, params)` (ex. node-postgres). Cette livraison **n'installe pas `pg`**, ne crée pas de base et **ne branche pas** ce gestionnaire sur le serveur V2. Un serveur de **staging** séparé pourra router `/api/v3/*` vers ce gestionnaire après préparation du fournisseur d'identité et d'un rôle SQL strictement limité.

## Tests sans dépendance externe

Après avoir ajouté les fichiers à la branche `feature/bus-v3-foundations` :

```sh
node --check src/v3/jwt.js
node --check src/v3/api.js
node --check src/v3/repository.js
node --check src/v3/bootstrap.js
npm test
```

La suite existante `npm test` découvre automatiquement les tests `test/v3-*.test.js`. Les tests API utilisent un serveur HTTP en mémoire et un faux référentiel de données ; **ils ne prouvent pas encore le comportement d'un fournisseur OIDC ou de PostgreSQL en production**.

## Bloquants avant un déploiement public

1. Choisir un fournisseur OIDC, vérifier ses vrais *access tokens*, sa rotation des clés, révocation des comptes et des sessions ; préparer tests bout en bout.
2. Créer **une base de test distincte** ; exécuter les migrations SQL 001/002 et ajouter **RLS PostgreSQL**, un rôle applicatif sans droits DDL ni `BYPASSRLS`, et tests multi-organisations.
3. Brancher le nouveau backend dans un service **staging séparé** de Render, avec HTTPS et configuration secrète côté serveur.
4. Ajouter protections de charge, audit des accès, limites de rétention, vérification institutionnelle des liens parent–élève et règles de confidentialité applicables en RDC.
5. Relier les permissions V3 à Socket.IO et prévoir la révocation immédiate du suivi GPS. Tant que ce n'est pas fait, la V2 emploie encore ses jetons statiques.
6. Ajouter les interfaces administrateur, transporteur, chauffeur et parent, puis effectuer un audit de sécurité indépendant avant usage réel.

**Garder la PR n° 2 en Draft et ne pas fusionner dans `main` pendant cette phase.**
