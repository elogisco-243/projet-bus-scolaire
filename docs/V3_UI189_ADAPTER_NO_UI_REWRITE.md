# UI-189 — Adaptation non destructive des quatre profils
Branche : `feature/bus-v3-ui189-role-adapters`.

Le module `mobile-session19/four-role-interface-adapter.mjs` classe les gestes existants de Chauffeur (`begin`, `arrive`, `resume`, `close-trip`, etc.), les actions Accompagnateur (`board`, `alight`, `mark_absent`, etc.) et les commandes de simulation Parent/Superviseur vers le réducteur UI-188.

**La portée est limitée :** ce code n'est encore *pas* raccordé aux boutons Android. Il permet l'exécution de scénarios sur un instantané en mémoire. Les actions démo demeurent synthétiques, sans comptes authentifiés et sans synchronisation entre appareils. Les commandes manquantes sont refusées, jamais acceptées tacitement.

La préservation des interfaces validées est impérative : ne pas réécrire `mobile-session19/app.mjs`, `mobile-session19/style.css`, ni le `ui.mjs` Chauffeur complet. Intégrer les adaptateurs par un chargeur indépendant, puis vérifier l'intégrité des ressources et les comportements Android avant de produire un nouvel APK.

Tests ajoutés : `test/v3-ui189-four-role-interface-adapter.test.mjs`. Commande :
```
node --test test/v3-ui188-four-role-demo-workflow.test.mjs test/v3-ui189-four-role-interface-adapter.test.mjs
```
Les vues Parent sont limitées aux élèves indiqués dans le contexte de simulation ; cette portée locale n'est pas une preuve d'autorisation parentale réelle.
