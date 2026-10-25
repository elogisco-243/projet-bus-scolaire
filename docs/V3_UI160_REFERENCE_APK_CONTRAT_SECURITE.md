# A2S Scola — UI-160 — Référence Chauffeur v1.7 et règles communes

**Statut : branche TESTHOST uniquement.** Ne pas fusionner, déployer ou présenter comme prêt pour des élèves réels. Référence : APK utilisateur `A2S-Scola_UI-145_20261021-232542-371_debug.apk` (versionName Android 1.7 ; package `cd.eneo360.busscolaire.v3`; SHA-256 `e34e8cc404c91cca3058a5c01394f5961f22603864716f851139413e5d5d27fe`). Le fichier APK original et Chauffeur v1.7 **ne sont pas modifiés**.

## Ce qui a été intégré dans Accompagnateur UI-160

### Parité visuelle fondée sur l'APK fourni
- Référence extraite des fichiers originaux `assets/public/ui-components.mjs`, `ui.mjs`, `theme.css`, `ui-136.css` de **cet APK exact**. Les chemins SVG sont conservés dans `mobile-session19/driver-ui145-reference.mjs` et utilisés par l'interface `mobile-session19/app.mjs`.
- Quatre menus : **Ma tournée · Alertes · Équipe · Plus** ; quatre actions : **DÉMARRER LA COURSE · NOUVELLE TOURNÉE · ARRÊT ATTEINT · CLÔTURER LA COURSE**.
- Fond / contraste des boutons actifs et inactifs conservant la lisibilité : Démarrer violet disponible, Arrêt atteint jaune seulement en cours, indisponibilité grise.
- Dimensions exactes de la référence sur téléphone : icônes de boutons **26 px**, **23 px sur écran bas**, barre inférieure **25 px** ; actions `clamp(78px,10.5dvh,92px)`, ou `clamp(68px,9.6dvh,78px)` en faible hauteur ; grille 2×2.
- Texte du prochain arrêt : **`#ffe48a`**, **`clamp(16px,4vw,20px)`** sur téléphone étroit, contraste original, texte long tronqué proprement ; sur écrans plus larges, typographie adaptative.
- Wi-Fi en ligne/hors ligne : SVGs originaux distincts. **Vert dans cette démo = état simulé, jamais liaison serveur réelle.**
- Le texte de statut initial **« À PRÉPARER »** du parcours Accompagnateur est conservé comme décidé précédemment. L'APK Chauffeur affiche « À DÉMARRER » ; les couleurs et transitions sont alignées, sans changer arbitrairement le libellé demandé.
- Les éléments propres à l'Accompagnateur (identité, confirmation fictive, pointage, alertes) restent spécifiques au rôle. **L'égalité pixel à pixel n'est pas revendiquée sans captures Android côte à côte.**

### Contrat partagé de sécurité (première intégration)
Nouveau `mobile-session19/shared-trip-contract.mjs`, code de validation pure et **sans serveur**. Il est maintenant importé par `mobile-session19/attendant-demo.mjs` et inclus dans le package TESTHOST :
- `checkArrivedStop` : statut de tournée active, bus déclaré sécurisé, arrêt réellement marqué atteint et **historique des arrêts contigu**.
- `checkStudentAtStop` : élève attendu à l'arrêt de montée/descente, pas de pointage hors arrêt, refus de doublon, absence déjà résolue ou mauvaise affectation.
- `checkClosure` : tous les arrêts, élèves affectés justifiés, aucun élève à bord, zéro incident ouvert, inspection explicite. Utilisé par la machine d'état Accompagnateur dans ses chemins de clôture.
- `verifyCrossRoleApproval` : **refus systématique des prétendues signatures locales** ; seule une future implémentation serveur avec deux identités contrôlées, révisions, anti-rejeu et traces auditables pourra les vérifier.

La version opérationnelle de ces fonctions **n'est pas implémentée**. Les données fictives de l'Accompagnateur (3 arrêts / E-01 et E-02) ne sont pas encore les données de la référence Chauffeur (Dépôt/Golf/Centre/École Horizon, quatre élèves A-01 à A-04). Elles restent isolées afin de ne pas casser une simulation existante ni simuler mensongèrement un état partagé.

## Tests

`test/v3-ui160-driver-parity-contract.test.mjs` : 13 scénarios vérifiant la référence APK, l'interface, les tailles, les SVG, les gardes arrivée/pointage, la clôture sécurisée, les faux accords croisés et la présence du contrat dans les assets Android.

`scripts/qa-ui160-windows.ps1` : script complet de tests Node ciblés → préparation TESTHOST → compilation Gradle → contrôle du **package de test** → installation uniquement sur `A2S_Scola_Phone_Stable` (Android 16, API 36) → capture de l'écran. Aucun accès à Render ni modification du Chauffeur. La commande `git pull --ff-only` doit être exécutée avant, après vérification de la branche de travail.

CI GitHub sur la branche : dernière suite source observée avant le présent document, **303 PASS, 0 FAIL, 5 TODO sur 308 tests**. La suite PostgreSQL/RLS est évaluée par des workflows distincts. Les TODO précédents portent sur l'intégration Android Chauffeur, deux comptes authentifiés, clôture/inspection et sécurité serveur ; un nouveau TODO porte sur la synchronisation signée des deux appareils.

**Ce sont des tests de code et de DOM simulé, et non une preuve de fonctionnement de deux vrais téléphones sur une même tournée.**

## Blocages explicites avant tout déploiement

1. Rassembler les sources **opérationnelles actuelles** des deux profils dans un contrat partagé de tournée (même ID, mêmes arrêts, roster affecté, statuts, incident et révisions). Le nouveau contrat pur est un point de départ et non encore un service.
2. Faire confirmer le départ, l'immobilisation, l'arrivée et la clôture par les rôles correspondants avec **contre-validation authentifiée côté serveur**, journal immuable et traitement des conflits ; ne pas déléguer la mise en mouvement du véhicule à l'Accompagnateur.
3. Traiter les blocages relevés sur l'APK Chauffeur fourni : un pointage peut y être enregistré sans preuve explicite d'arrivée dans l'ancien module partagé ; la clôture normale ne contrôle pas tous les élèves attendus ni une inspection formelle. Le module spécifique de l'APK refuse néanmoins la clôture avec élèves marqués à bord — ne pas confondre avec le prototype plus ancien du dépôt.
4. Essais dos à dos **de deux APK exacts sur deux émulateurs distincts**, mode réseau dégradé, incidents critiques, élève manquant, arrivées simultanées, conflits de révisions et validation finale du bus vide. N'utiliser que des données fictives.
5. Ne pas réutiliser une clé `localStorage` inter-appareils comme système de synchronisation, ni un booléen JS `authorized=true` comme preuve d'identité.
6. Recompiler UI-160 et vérifier une capture Android. **Aucun APK UI-160 n'a été construit sur le PC utilisateur par le présent travail GitHub.**

## Décision

**UI-160 = référence visuelle Chauffeur réelle et règles communes de sécurité intégrées dans la Démo Accompagnateur ; homologation opérationnelle refusée à ce stade.** Le prochain lot doit relier des données de tournée communes au service métier authentifié, et non ajouter de nouveaux clics de validation à l'utilisateur.
