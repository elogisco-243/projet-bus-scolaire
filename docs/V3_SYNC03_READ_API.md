# A2S Scola — SYNC-03 : passerelle API de consultation (non déployée)

Statut : proposition technique isolée, **lecture seule**, et **non branchée sur Render, V2, ni l'APK UI-145**.

## Livrables

- src/v3/sync03-read-api.js : contrat HTTP protégé par Bearer JWT déjà vérifié, fournisseur de compte de confiance, filtrage strict des enfants/affectations avant réponse.
- test/v3-sync03-read-api.test.js : dix scénarios HTTP incluant JWT RS256 signé, parent avec un seul enfant autorisé, chauffeur affecté, accompagnateur affecté, révocation, autre école et absence de fuite.
- .github/workflows/v3-sync03.yml : Node 22, tests isolés. Aucun déploiement, aucune base ou secret.

## Routes PROPOSÉES — non exposées aujourd'hui

- GET /api/v3/sync/me : identifiant opaque de l'acteur et ses rôles/organisations actifs, établis **côté serveur**.
- GET /api/v3/sync/trips/{uuid}/snapshot : uniquement pour une tournée autorisée. Pour un parent, uniquement ses enfants vérifiés **et affectés** à la tournée, avec leurs événements; aucun autre enfant, arrêt, nom, position, agent ou jeton.
- Toute requête POST, PUT, PATCH, DELETE reste sans effet. Pas de pointage serveur réel dans SYNC-03 étape 1.

## Contrat de dépendances

createSync03ReadApi({ verifyToken, loadActor, loadTripSnapshot }) reçoit TROIS fonctions de confiance:
- verifyToken doit être createJwtVerifier() avec clés épinglées, issuer/audience spécifiques et rotation des accès revue.
- loadActor(subject) résout le sujet de jeton vers un compte actif et ses permissions réelles, jamais depuis un champ client.
- loadTripSnapshot(actor,tripId) doit interroger la base via un rôle SQL **lecture seule RLS**, en **transaction sur la même connexion**, après contrôle d'identité. Il fournit un contexte serveur: trip, tripStudentIds, attendantAssignments, studentStatuses, studentEvents, routeStops. Ne jamais exposer directement des tables au client.
- Les tests utilisent des fausses données; **aucun repository PostgreSQL de ce contrat n'est encore câblé**. Les anciens modules V3 repository.js/bootstrap.js ne constituent pas une intégration RLS prête au déploiement.

## Étapes obligatoires suivantes

1. Ajouter les colonnes/queries nécessaires à la projection de snapshot et créer une vraie transaction d'autorisation SQL vérifiée contre PostgreSQL 16.
2. Valider RLS sur Render PostgreSQL managé avec un compte SQL ne disposant d'aucun droit de contournement, sans rendre la base accessible publiquement.
3. Configurer un fournisseur OIDC (clé publique, rotation, révocation) ; ne pas coder des comptes fixes ou jetons statiques dans le mobile.
4. Concevoir un service d'écriture idempotent avec rôle SQL distinct, transactions et audit, sans accorder d'INSERT au lecteur.
5. Tester entièrement avec de fausses références enfants sur téléphones distincts, sur réseau dégradé et après révocation d'un parent ou accompagnateur.
6. Soumettre revue sécurité, conservation, consentement et obligations locales avant lancement.

**Ne pas fusionner sur main ni déclencher le déploiement de V2 / Render V3 depuis cette branche.**
