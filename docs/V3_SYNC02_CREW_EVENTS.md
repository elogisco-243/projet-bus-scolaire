# A2S Scola — SYNC-02: contrats sécurisés du backend V3

**Statut au 21 octobre 2026 : proposition testable, non déployée.**

## Objet

Conserver la version mobile UI-145 validée tout en préparant le backend aux échanges entre appareils : affectation explicite de l'accompagnateur, autorisation exceptionnelle du chauffeur seul, journal serveur des montées et descentes, et séparation stricte des données selon les profils.

## Code livré

- `src/v3/sync02-events.js` : validation des événements offline de type `board` / `alight`, vérification des autorisations en mémoire à partir **uniquement de données fiables extraites côté serveur**, classification des doublons. Aucune API réseau activée.
- `test/v3-sync02-events.test.js` : 10 tests Node.js avec des identifiants entièrement fictifs.
- `db/migrations/004_v3_sync02_crew_events.sql` : **migration de staging proposée**, après 001–003. Ajoute le rôle `attendant`, les affectations explicites d'accompagnateurs, les autorisations solo, les pointages idempotents et une politique RLS de lecture cloisonnée.
- `db/tests/003_v3_sync02_regression.sql` : tests PostgreSQL sur une base jetable (régression parent/enfant, accompagnateur d'un autre opérateur, transitions, événements répétés, absence de droits d'écriture).
- `.github/workflows/v3-sync02.yml` : exécution des contrôles dans GitHub Actions / PostgreSQL 16 **jetable uniquement**. Aucun script CI ne touche Render.

## Correspondance mobile ↔ serveur

Format de `offline-queue.mjs` déjà présent dans UI-145 :

```json
{"id":"uuid-evenement","tripId":"uuid-tournee","studentId":"uuid-eleve","stopId":"uuid-arret","type":"board","occurredAt":"date-ISO-UTC"}
```

`id` est l'identifiant idempotent ; le client peut réessayer le **même** événement après une coupure. Le serveur doit d'abord calculer l'arrêt autorisé et l'identité côté serveur (`materializeAuthorizedEvent`) même si `stopId` est absent du mobile. L'idempotence compare cette représentation canonique. Le serveur doit renvoyer `recorded` ou `already_recorded` uniquement après vérification du même acteur et du même contenu. Un ID réutilisé pour une autre action doit être refusé.

L'application actuelle utilise aussi des références locales fictives comme `A-01`. Elles **ne sont pas** des UUID PostgreSQL ; une correspondance approuvée par l'administration est obligatoire avant toute synchronisation réelle.

## Contrôles de droits

- **Administrateur scolaire** : gère les références et les liens parent-enfant vérifiés ; consulte uniquement son école.
- **Gestionnaire transporteur** : affecte chauffeur et accompagnateur de sa propre organisation, avec vérification en base.
- **Accompagnateur** : pointage seulement si compte actif, rôle actif, affectation non révoquée et tournée active. La route et l'arrêt sont vérifiés côté serveur.
- **Chauffeur seul** : refusé si un accompagnateur actif est affecté ; nécessite une autorisation solo accordée côté serveur et non révoquée. La simple sélection du mode solo sur téléphone ne suffit pas.
- **Parent** : ne peut jamais enregistrer de pointage. En lecture, les politiques RLS n'autorisent que les informations de son ou de ses propres enfants avec lien vérifié et affectation à la tournée.
- **Tous** : aucune transmission d'un rôle, d'un `actorUserId` ou d'un drapeau `authorized` depuis un téléphone ne peut accorder un droit.

La validation `parkedConfirmed` dans le contrat JavaScript **ne constitue pas une preuve physique que le bus est arrêté**. Elle doit être alimentée par un état serveur auditable, avec des garanties opérationnelles adaptées ; aucun droit de pointage réel ne doit être ouvert sur la seule base d'une case cochée sur le téléphone.

## Verrous de sécurité encore nécessaires

1. **Migration SQL CI : non encore exécutée** au moment de la préparation de ce kit. Ne pas lancer directement la migration sur la base Render existante. Vérifier la compatibilité du rôle PostgreSQL managé et des fonctions `SECURITY DEFINER` / `FORCE RLS` avant de l'appliquer dans une base jetable.
2. **Aucune API d'écriture** : le rôle `bus_v3_reader` ne reçoit aucun droit INSERT/UPDATE/DELETE. La future API de pointage doit utiliser un rôle SQL distinct minimal, des transactions, l'idempotence garantie en base et des tests d'attaques concurrentes.
3. **Identité OIDC** : valider le fournisseur réel, des sessions révocables, la chaîne de confiance JWT → utilisateur → rôle → permissions SQL signées.
4. **État de l'arrêt** : le serveur doit connaître l'arrêt courant, et le bus doit être déclaré immobilisé dans un contexte traçable ; vérifier sécurité opérationnelle, limitations et risques de contournement.
5. **Protection des mineurs** : respecter l'accès par enfant, la minimisation des données, le consentement applicable, la politique de conservation et un audit de sécurité indépendant.
6. **Conflits et hors ligne** : file persistante et chiffrée côté mobile, traitement dans l'ordre (`sequence_no` serveur), rejets auditables, révocations appliquées avant l'acceptation, actualisation par profils et filtrage des événements de parents.
7. **Tests sur appareils distincts** : utiliser exclusivement des élèves fictifs. Les fonctionnalités ne seront déclarées synchronisées qu'après tests de bout en bout sur téléphones séparés.

## Instruction de publication

Publier uniquement vers `feature/bus-v3-sync02-crew-events`, issue de `feature/bus-v3-foundations`, puis ouvrir une pull request **Draft** vers `feature/bus-v3-foundations` ; ni fusion vers `main` ni déploiement Render.
