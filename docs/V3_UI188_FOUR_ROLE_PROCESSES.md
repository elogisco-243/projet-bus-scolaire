# UI-188 — Processus complets des quatre profils (moteur Démo)

## Principe non négociable
Le parcours **Accompagnateur UI-170/UI-178** est le modèle d'ergonomie et de discipline métier. Aucune modification de `mobile-session19/app.mjs`, `style.css` ou du Chauffeur historique. Circuit retenu **LUB-014 / Dépôt → Golf → Centre → École Horizon**. Seule une nouvelle couche métier pure est ajoutée. Le mode Opérationnel demeure **bloqué**.

## Cycle commun de tournée
1. La tournée est planifiée et les élèves fictifs affectés.
2. L'Accompagnateur confirme sa présence ; le Chauffeur sécurise le véhicule.
3. L'Accompagnateur déclare la préparation au départ ; le Chauffeur lance la tournée.
4. À chaque arrêt, le Chauffeur confirme l'immobilisation puis l'arrivée à l'arrêt suivant dans l'ordre.
5. L'Accompagnateur effectue pour chaque élève le pointage de montée, la descente à l'arrêt attribué ou l'absence justifiée.
6. Le Chauffeur reprend la route uniquement après résolution des pointages de l'arrêt et traitement des incidents.
7. Au terminus, tous les arrêts doivent être atteints, tous les élèves justifiés, aucun élève à bord, aucun incident ouvert ; l'Accompagnateur confirme l'inspection du bus vide.
8. Le Chauffeur clôture ; le Superviseur peut relire la tournée achevée.
9. Les vues Parent suivent la situation des seuls élèves attribués à leur démonstration.

## Chauffeur — actions développées dans le réducteur
- Sécuriser le véhicule, démarrer la tournée, confirmer l'arrivée à l'arrêt, reprendre la route, déclarer un incident, clôturer.
- Refus de départ sans présence/préparation Accompagnateur et immobilisation du véhicule.
- Refus de progression si pointage incomplet ou incident ouvert.
- Refus de clôture sans terminus, inspection finale et bus vide.
- Les fonctions avancées héritées du Chauffeur ne sont **pas** supprimées : le moteur UI-188 est parallèle, pas un remplacement de son interface ou de ses commandes.

## Accompagnateur — actions développées
- Présence, confirmation de préparation, montée/descente/absence par élève et arrêt, incident, confirmation du bus vide.
- Refus des doublons, des élèves non affectés, d'une mauvaise étape, d'une absence sans justification.
- Interdiction de pointage si la course est inactive ou si le bus/arrêt n'est pas sécurisé.
- Les parcours complets UI-178 (animation, pointage express, retour arrière et écrans secondaires) restent dans le moteur original, encore **non raccordé** au nouveau réducteur.

## Parent — processus métier
- Lecture du trajet, progression et statut des élèves associés à son compte de démonstration ; notifications de montée/descente/absence.
- Accusé de lecture d'une notification en Démo.
- Aucune commande de conduite, de pointage ou de traitement d'incident.
- **Sécurité à compléter** : l'identité du parent et le lien légal parent-enfant devront être déterminés et vérifiés côté serveur. Une liste locale n'accorde aucun droit réel.

## Superviseur — processus métier
- Vue globale : circuit, étapes, élèves affectés, incidents ouverts.
- Traitement simulé d'incidents après immobilisation ; revue finale d'une course clôturée.
- Aucun accès implicite à la conduite ou au pointage.
- Un traitement simulé ne vaut ni levée réelle d'une urgence, ni autorisation opérationnelle.

## Architecture
- `mobile-session19/four-role-demo-workflow.mjs` : transitions métier pures, journal d'événements simulés, notifications fictives, refus des actions hors profil.
- `test/v3-ui188-four-role-demo-workflow.test.mjs` : scénarios de bout en bout.
- `mobile-session19/golf-route-adapter.mjs` : définition partagée du circuit.
- `mobile-session19/golf-session-store.mjs` : préparation de la persistance, sans transaction atomique multi-onglet.

## Limites et étapes avant APK opérationnel
Les scénarios UI-188 sont des **simulations** sans comptes authentifiés, signatures, interconnexion réseau ni géolocalisation réelle. Ils ne vérifient pas physiquement l'immobilisation ; l'état est déclaré. Ils ne remplacent pas les interfaces d'origine. Les tests sont écrits mais ne valent pas validation Android.

Pour produire un APK réellement unifié, il faut ajouter des adaptateurs explicites qui traduisent les événements des interfaces existantes vers ce moteur, les tester sans altérer la présentation, puis mettre en place un service de synchronisation, les règles de permission vérifiées côté serveur, l'attribution des élèves, le journal d'audit, l'idempotence, la gestion hors-ligne, les conflits et la reprise. La démo locale ne doit jamais se faire passer pour ces services.

## Tester localement
`node --test test/v3-ui188-four-role-demo-workflow.test.mjs`
