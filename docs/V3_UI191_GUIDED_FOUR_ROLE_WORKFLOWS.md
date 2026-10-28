# UI-191 — Assistant de manipulation simple par profil
La couche `four-role-guided-actions.mjs` combine la recommandation contextuelle UI-190 et les transitions UI-188. Elle ne change ni `mobile-session19/app.mjs` ni `style.css`, ni les ressources Chauffeur. Une action proposée doit correspondre à l'action principale courante puis être autorisée par le réducteur métier. Les suggestions de navigation restent en lecture seule.

Les processus couverts par le nouveau pont de démonstration : immobilisation, présence et préparation, départ, arrivée à l'arrêt, reprise et clôture, confirmation du bus vide, revue de supervision. Pour le pointage, les incidents et les notifications, les paramètres métier sont nécessaires : l'interface détaillée existante doit les fournir explicitement ; la couche de suggestion ne déclenche pas automatiquement de changement.

Les vues Parent restent limitées aux identifiants d'élèves fictifs explicitement fournis. Il n'existe toujours pas de vraie authentification des parents.

## Validation
`node --test test/v3-ui188-four-role-demo-workflow.test.mjs test/v3-ui190-four-role-simple-actions.test.mjs test/v3-ui191-guided-actions.test.mjs`

État : modules développés, tests ajoutés, mais le câblage des boutons de l'APK UI-186 n'est pas encore réalisé et aucune synchronisation multi-appareil n'existe. Aucun APK UI-191 créé. Le mode opérationnel est refusé.
