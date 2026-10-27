# UI-182 — Application progressive des règles Accompagnateur au Chauffeur
Le **Chauffeur** est le profil à remettre à niveau. Les règles avancées du contrat UI-160 ont été consolidées dans `mobile-session19/driver-advanced-rules.mjs` : départ sécurisé, équipage présent ou remplacement/solo explicitement autorisé en démo, contrôle des arrêts, pointage uniquement à un arrêt confirmé, interdiction des doublons via contrat commun, clôture avec réconciliation et inspection explicite, interdiction de recommencer avant clôture.

**État exact :** module de politique pure et tests ajoutés sur la branche `feature/bus-v3-ui182-driver-advanced-parity`. Ce module n'est **pas encore raccordé** au `ui.mjs` de l'APK Chauffeur UI-179 sur le PC, ni validé en APK. La référence visuelle finale du Chauffeur reste à confirmer. Le seul contrôle de rôle local en démo ne constitue pas une authentification réelle.

## Invariants
- Garder l'Accompagnateur UI-178/UI-170 et les modifications locales intactes.
- Préserver le menu Ma tournée · Alertes · Équipe · Plus, les quatre boutons et le format compact déjà convenu.
- Pas de véritable autorisation de départ par l'Accompagnateur ; toute validation croisée opérationnelle exige deux comptes et une vérification serveur.
- Le mode opérationnel demeure bloqué, et la synchronisation entre deux APK n'est pas réalisée.
- La remise à niveau de `ui.mjs` devra d'abord adapter les données Chauffeur historiques au même modèle `stops/students/trip`, avec tests de non-régression et comparaison visuelle sur Android.

### Contrôle local (non destructif)
`node --test test/v3-ui182-driver-advanced-rules.test.mjs`

La branche distante est indépendante des modifications non committées du PC. Ne pas effectuer de `git switch`, `reset` ni remplacer `mobile-session19/app.mjs`.
