# UI-193 — Écrans Parent et Superviseur (Démo), basés sur la référence Accompagnateur

## Livrable
- `mobile-session23/index.html` : point d'entrée des deux interfaces nouvelles en Démo.
- `mobile-session23/role-screens.css` : couleurs violettes, en-tête et navigation fixe à quatre rubriques, écrans compacts adaptés au téléphone et à la tablette.
- `mobile-session23/role-screens.mjs` : navigation fonctionnelle entre **Ma tournée / Alertes / Équipe / Plus**, écran d'accès démonstration Parent ou Superviseur, retour à l'accueil.
- `test/v3-ui193-parent-supervisor-screens.test.mjs` : contrôles de données et de structure.

## Parcours Parent
L'accueil affiche le statut du bus LUB-014, le prochain arrêt, l'avancement du circuit Golf et le statut de son enfant fictif A-01. La rubrique Alertes présente uniquement ses notifications. Équipe donne des consignes et Plus expose les limites.

## Parcours Superviseur
L'accueil affiche l'état du bus, les arrêts atteints, les élèves à bord et affectés. Alertes contient les incidents simulés. Équipe précise les responsabilités respectives. Plus affiche les limites.

## Simplicité et non-régression
La mise en page reprend l'esprit compact et la palette de l'Accompagnateur. **Aucune ressource Chauffeur/Accompagnateur existante n'est modifiée.** Il s'agit d'écrans distincts développés pour Parent et Superviseur, pas d'une réécriture des deux applications mûres. Aucun écran n'est présenté comme de la géolocalisation réelle.

## Sécurité et limites
La sélection du rôle sur l'écran de démonstration n'authentifie personne. L'enfant fictif A-01 est un exemple, pas une affectation parentale vérifiée. Les données initiales sont des fixtures locales, non alimentées par l'APK UI-186. Il n'y a pas de synchronisation réseau, ni de vraie notification, ni de levée opérationnelle d'incident. Les écrans ne sont pas encore raccordés au portail Android UI-186 et **aucun APK UI-193 n'a été compilé**.

Tests à exécuter depuis le dépôt : `node --test test/v3-ui193-parent-supervisor-screens.test.mjs test/v3-ui192-parent-supervisor-dashboard.test.mjs`.

Avant APK : intégrer ces fichiers comme ressources séparées, garder les empreintes originales des interfaces complètes, et remplacer les données fictives par des vues du moteur commun après validation des autorisations serveur.
