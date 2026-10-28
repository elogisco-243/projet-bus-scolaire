# UI-186 — Rectification : Accompagnateur intangible

La version UI-185 a remplacé à tort les interfaces validées par une interface synthétique. Ne pas réutiliser ses écrans comme base. Le profil Accompagnateur UI-170/UI-178, `mobile-session19/app.mjs`, `mobile-session19/style.css` et ses composants sont **référence immuable** (pas de modification CSS/HTML/JS, aucune reconstruction à partir d'une maquette).

## Plan d'intégration exact

1. Conserver le shell de connexion commune UI-184, avec quatre rôles en démo (mode opérationnel désactivé). Adapter uniquement le chargeur de session.
2. Rendre l'écran Accompagnateur complet en réutilisant **sans remplacement ni duplication de logique** les assets `mobile-session19` approuvés. Mettre le contenu dans un répertoire de ressources distinct et préserver ses imports relatifs.
3. Trajet commun à fournir via **adaptateur de données externe** et contrat explicitement testé : bus LUB-014, Dépôt, Golf, Centre, École Horizon. Ne pas coder le changement de trajet en réécrivant `app.mjs` ou `attendant-demo.mjs` ; tant que le contrat de données n'est pas accepté, laisser les données Accompagnateur existantes et indiquer clairement l'absence de synchronisation.
4. Chauffeur : reconstruire son écran en réutilisant la composition et les composants visuels exacts de l'Accompagnateur, mais en conservant les actions Chauffeur et les permissions UI-182.
5. Parent, Superviseur : implémenter des interfaces propres aux rôles, reprenant seulement les composants graphiques, pas les commandes Chauffeur/Accompagnateur.
6. Valider par captures côte à côte à résolution égale, scénarios et tests de non-régression sur UI-178. Tester la communication de données réelle uniquement après raccordement d'un moteur commun.
7. Ne pas intervenir sur la copie Windows avec modifications locales non committées. La branche UI-186 est une base documentaire sans installation ni APK.

## Critères de refus
- Toute modification visuelle de l'Accompagnateur fait échouer la recette.
- Une interface de remplacement simplifiée n'est pas admissible.
- Une session choisie librement en Démo ne vaut pas authentification.
- Ne pas déclarer la synchronisation effective sur plusieurs téléphones ni la sécurité opérationnelle sans test.
