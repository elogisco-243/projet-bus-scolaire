# A2S Scola — UI-161 — Bonne action au bon moment

## Déclencheur
Capture réelle UI-160, profil Accompagnateur, Android 16 : statut **EN COURS**, **1/3** arrêt, **0** élève à bord, bulle Élèves en attente ; **quatre gros boutons simultanément gris**, switch de préparation présent pendant la tournée, affichage **PROCHAIN ARRÊT / Arrêt fictif A** alors que le bus est encore au **Dépôt** (arrêt actif).

## Problèmes établis et corrections UI-161
1. **Arrêt affiché incorrectement** : quand `atStop` est vrai, le grand encadré affiche maintenant **ARRÊT ACTUEL — Dépôt** ou le nom réel de l'arrêt actif, et seulement **PROCHAIN ARRÊT** pendant une transition. Les données du trajet ne changent pas.
2. **Les quatre boutons sont gris en attente de pointage** : le bouton **ARRÊT ATTEINT** conserve son libellé original du Chauffeur v1.7, mais quand il existe un pointage en attente à l'arrêt actuel, il devient **jaune et utilisable** et ouvre directement le pointage (`go_students`). Il **n'appelle pas** `simulate_arrival` et ne peut donc pas compter le même arrêt deux fois. La bulle « ÉLÈVES À BORD » garde le même accès.
3. **Switch “Prêt au départ” hors contexte** : visible uniquement lorsque la tournée est **planifiée**. Une fois démarrée, la même ligne indique sans action superflue soit « Trajet en cours (démo) », soit « Arrêt enregistré · Sécurisation simulée / Pointage à effectuer », soit « Tournée terminée (démo) ».
4. **Boutons inactifs vs actifs** : gris réel pour impossible, couleur saturée pour action possible, pas de faux bouton actif. L'accessibilité décrit qu'« Arrêt atteint » ouvre le pointage quand déjà arrivé.
5. **Écran compact** : la nouvelle information de sécurité réutilise la hauteur de ligne existante ; les quatre actions et les quatre onglets restent à leur position de référence.

## Sécurité et limites
- Le clic sur « ARRÊT ATTEINT » n'enregistre un arrêt que lorsque la machine d'état autorise `simulate_arrival`. Lorsqu'un arrêt est en cours de pointage, il ne fait **qu'ouvrir les élèves**, jamais une nouvelle arrivée.
- À une étape sans élève, la progression simulée reste contrôlée par le moteur UI-159 et ses vérifications.
- Aucune validation du Chauffeur réel, immobilisation physique ou connexion serveur n'est déduite d'un clic. La **simulation reste explicitement isolée** des comptes opérationnels.
- Les contrôles d'arrivée, d'élèves, d'inspection finale et de clôture issus de UI-160 demeurent actifs.
- Chauffeur APK v1.7 UI-145, branche `main`, Render et données réelles **inchangés**.

## Tests
`test/v3-ui161-current-stop-pointage.test.mjs` : 7 tests automatisés sur l'écran et les transitions d'état. Cette suite vérifie, notamment, le nom de l'arrêt réellement actif, le pointage en un appui, l'interdiction d'un double arrêt, le libellé suivant après la reprise et la disparition du switch de préparation.
Les anciennes assertions UI-159 ont été mises à jour pour tenir compte de la nouvelle destination du bouton Arrêt atteint lorsque le pointage est en attente.

## Vérification Android
`scripts/qa-ui161-windows.ps1` : exécute tests ciblés, compilation, garde de package, installation sur `A2S_Scola_Phone_Stable` Android 16, lancement et capture de l'accueil après délai de rendu. **UI-161 n'est pas encore compilée et vérifiée visuellement sur l'ordinateur de l'utilisateur.**

**Statut : correction UI et tests du code intégrés sur la branche isolée; déploiement opérationnel toujours bloqué.**
