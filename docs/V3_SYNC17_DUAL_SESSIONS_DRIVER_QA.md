# UI-150 / SYNC-17 — cohabitation Démo / Opérationnel et qualification Chauffeur

**23 octobre 2026, branche brouillon.** Conserver UI-145 et V2/main, Render désactivé, données fictives uniquement.

## Décision
- Le formulaire de connexion reste commun ; le compte détermine le profil et le contexte, sans sélecteur manuel Démo/Opérationnel.
- Les sessions Démo et Opérationnelles sont étanches. Le rendu Démo importe le modèle local fictif ; les sessions réelles exigent OIDC, autorisations et affectations serveur et ne doivent jamais charger `ui.mjs` de simulation.
- **Aujourd'hui seul le chemin Démo est fonctionnel**. Le code client Android n'a pas de fournisseur OIDC opérationnel relié, l'API V3 métier n'est pas activée : pas de faux accès de production. Les futures sessions réelles requièrent un adaptateur serveur audité.
- Un booléen `serverVerified` en JavaScript ne garantit pas la sécurité : serveur OIDC/JWT + appartenances PostgreSQL/RLS + vérification des tournées demeurent obligatoires.

## Artefact Windows
`A2SScola-SYNC17-Sessions-Chauffeur.zip` : script `Check` / `Apply` fail-closed ciblant uniquement la copie D: après preuve de l'empreinte de UI-149, du CSS UI-148, du login exact, du package test et du marqueur isolé. Patch de `index.html`, `ui.mjs` et nouveau `session-router.mjs`. Sauvegardes/rollback. Aucune compilation, installation APK ou intervention Render.

La page Démo indique explicitement : « Liaison simulée », « Hors ligne (démo) », « Accusé simulé · aucun envoi », « Simuler la synchronisation ». Les états locaux `synced` ne prouvent pas une transmission serveur.

## Scénarios chauffeur automatisés
Tests `node --test` exécutés sur modèles de référence locaux (Node 22) : **75/75 PASS** :
- comptes Démo vs opérationnel et rôles, absence de fallback ;
- équipage accompagné, remplaçant, chauffeur seul exceptionnel, présence obligatoire et bus immobilisé ;
- départ, reprise du départ, arrêts, doublons, terminus ;
- montées/descentes, élèves inconnus ou déjà à bord, véhicule en mouvement, autorisations ;
- clôture, enfants encore à bord, approbations et exception documentée ;
- six alertes et criticité, hors ligne, accusés simulés, GPS fictif.
Ces tests de composants ne représentent PAS les actions de la WebView ni une API opérationnelle.

## Risques non encore levés
La manipulation des choix d'équipage et le traitement des alertes pendant l'état conduite doivent faire l'objet de gardes et tests dynamiques supplémentaires. La case « bus immobilisé » est une déclaration, pas un capteur. Les flux synchronisés entre vrais appareils et le stockage chiffré par organisation sont à qualifier.

**Étape de suite** : recueillir `Check` puis `Apply` sur D:, puis compiler sous contrôle et tester l'AVD hors ligne ; vérifier le rôle Chauffeur avant de passer à l'Accompagnateur. Aucun usage avec de vraies données mineures.
