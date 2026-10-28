# UI-187 — Contrat de données commun Circuit Golf
**Livré sur la branche :** `feature/bus-v3-ui187-shared-golf-data`.

- `mobile-session19/golf-route-adapter.mjs` : source immuable `GOLF_ROUTE`, quatre arrêts Dépôt → Golf → Centre → École Horizon, bus LUB-014, quatre élèves fictifs A-01 à A-04, instantané de démonstration, validation d'intégrité et vues de lecture Chauffeur, Accompagnateur, Parent, Superviseur.
- `test/v3-ui187-golf-route-adapter.test.mjs` : tests du contrat, des quatre vues, de la progression et des refus.
- **Invariants :** aucune modification du code des interfaces Accompagnateur UI-178 et Chauffeur complet ; aucune modification des APK UI-186 installés ; toute commande opérationnelle et toute prétendue synchronisation distante sont refusées.
- **Limite explicite :** ceci est une **couche de données non branchée** aux moteurs Chauffeur / Accompagnateur existants. Les écrans des deux profils affichent donc encore leurs données locales indépendantes. L'adaptation des modèles de tournée et la persistance locale entre quatre sessions restent à implémenter et valider **sans modifier les fichiers d'interface**. Les rôles de projection ne prouvent pas une identité authentifiée.
- **Vérification :** `node --test test/v3-ui187-golf-route-adapter.test.mjs`.

Ne pas remplacer `mobile-session19/app.mjs` ni `style.css` ; ne pas repartir du UI-185 simplifié.
