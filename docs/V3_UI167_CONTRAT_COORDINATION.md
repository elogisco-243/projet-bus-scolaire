# A2S Scola UI-167 — Contrat initial de coordination

## Portée

Ce lot expérimental fait suite aux quatre scénarios Accompagnateur UI-166 jugés maniables par l'utilisateur. Il prépare les échanges Chauffeur / Accompagnateur / Parent sans modifier les écrans validés ni la version de référence Chauffeur v1.7.

Le module `mobile-session21/coordination-demo.mjs` fonctionne **uniquement en mémoire, sur données fictives**. Il ne dispose ni d'un serveur, ni de sessions vérifiées, ni d'une vérification réelle des badges. Sa fonction `authorizeOperationalCommand()` refuse toujours la mise en service réelle.

## Responsabilités et validations

- **Chauffeur** : démarre la tournée, déclare les arrivées et reprend explicitement la conduite.
- **Accompagnateur** : confirme la préparation, effectue les pointages, vérifie les élèves attendus et valide qu'un arrêt peut être quitté.
- **Parent** : consulte uniquement ses enfants et soumet une demande de changement d'arrêt ; cette demande ne modifie jamais directement la destination.
- **Superviseur** : examine les demandes exceptionnelles et les décisions qui exigent une autorisation distincte.

La validation croisée porte sur la sécurité de l'arrêt, **pas sur une confirmation supplémentaire de chaque élève** : cela préserve la maniabilité observée dans UI-166.

## Tests de protocole

Le modèle vérifie l'ordre des arrêts, les responsabilités fictives des acteurs, les révisions et doublons de commande, les pointages attendus, les demandes Parent, les alertes critiques et la séparation entre revue d'identité simulée et remise physique simulée.

**Aucune preuve locale ne vaut autorisation serveur.** En particulier, un badge seul ne suffit pas pour remettre un enfant ; une demande Parent en attente ne peut pas modifier sa destination.

## Conditions préalables à la mise en service

1. Serveur de tournée unique avec authentification, affectation des rôles et isolation par établissement.
2. API transactionnelle avec idempotence, révision de tournée et journal d'événements.
3. Connexion effective des appareils Chauffeur / Accompagnateur et de l'application Parent.
4. Contrôle réel des personnes habilitées, modifications d'arrêt, remises et révocations.
5. Gestion prudente des coupures réseau, validation des incidents critiques et essais de sécurité en conditions contrôlées.

**Décision :** UI-167 est un prototype de contrat de synchronisation, pas une synchronisation effective. Mise en service réelle : **NO-GO**. Branche de test exclusivement ; `main` et Chauffeur v1.7 inchangés.
