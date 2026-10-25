# A2S Scola — UI-158 — Parcours simplifié sur le modèle Chauffeur

## Décision
L'écran Accompagnateur conserve **exactement quatre gros boutons** (DÉMARRER LA COURSE, NOUVELLE TOURNÉE, ARRÊT ATTEINT, CLÔTURER LA COURSE) et quatre onglets (Ma tournée, Alertes, Équipe, Plus), selon le modèle visuel Chauffeur v1.7. Pas de sous-menu « Pointage » : la bulle **Élèves à bord** est son accès unique. Les états violet/vert, Wi-Fi fictif et bulle Arrêts atteints UI-157 sont conservés.

## Parcours Démo réellement implémenté
1. **Avant départ** — un seul switch « Prêt au départ » enregistre en local une **préparation entièrement simulée** : présence de l'Accompagnateur et sécurisation/accord Chauffeur **fictifs**, jamais des validations professionnelles réelles. Le bouton Démarrer devient actif.
2. **Départ** — toucher directement **DÉMARRER LA COURSE** : la tournée passe en cours (vert). Aucun assistant à trois étapes, aucun second bouton Démarrer sur une sous-page.
3. **Arrivée** — toucher directement **ARRÊT ATTEINT** sur Ma tournée : l'arrivée du prochain arrêt est **synthétique**, jamais une géolocalisation. Le compteur augmente, la bulle Élèves attire l'attention.
4. **Pointage** — toucher **ÉLÈVES À BORD** : élèves concernés de l'arrêt actif, actions Monter / Absent / Descendre. Après le dernier pointage attendu à un arrêt intermédiaire et sans alerte critique, la **reprise fictive** est automatique dans la simulation et retour à Ma tournée. Aucun pointage n'est créé automatiquement.
5. **Clôture** — après les trois arrêts, élèves tous justifiés, zéro enfant à bord et aucune alerte ouverte, le bouton **CLÔTURER LA COURSE** ouvre uniquement la confirmation finale « Je confirme le bus vide et clôture (démo) ». Une seule confirmation explicite et atomique enregistre inspection + clôture ; aucune inspection n'est déduite automatiquement.
6. **Nouvelle tournée** — réinitialisation d'une nouvelle simulation locale **uniquement après clôture**. Une tournée inachevée ne peut pas être effacée via ce bouton.
7. **Alertes / Équipe / Plus** — structure conservée, aucun envoi réel, réseau affiché = simulation. Les alertes critiques ouvertes bloquent la reprise fictive.

## Garanties et limites
- Testhost `cd.eneo360.busscolaire.v3.sync09.test`, **sans serveur réel** ; CSP `connect-src 'none'`.
- Toutes les nouvelles transitions passent par la machine d'état DEMO et les actions d'accompagnement `authorizeAttendant` appropriées.
- La version Chauffeur v1.7, Render, la branche principale, les élèves réels et la base opérationnelle restent **inchangés**.
- En environnement opérationnel, **les rôles restent distincts** : le Chauffeur valide réellement son départ, son arrivée et la sécurisation; l'Accompagnateur confirme présence, pointage et bus vide. Si les deux rôles peuvent initier un événement commun, la validation croisée doit venir de l'autre compte authentifié. **Ceci n'est pas implémenté ni démontré par le testhost.**
- La parité graphique parfaite avec Chauffeur doit être comparée sur appareil ; les tests sur GitHub vérifient le DOM et la logique, pas l'affichage physique.

## Vérifications automatisées
Tests ciblés ajoutés : `test/v3-ui158-simple-driver-flow.test.mjs`.
La suite comprend les régressions des lots UI-153 à UI-158 et SYNC-18 / SYNC-19. Exécuter les tests Node locaux et une nouvelle compilation APK avant toute validation sur Android 16.

## Commandes locales
```powershell
cd D:\A2S-Scola-UI153-Phone
git pull --ff-only origin feature/bus-v3-sync18-attendant-qa
node --test .\test\v3-sync18-attendant.test.mjs .\test\v3-sync19-attendant-demo.test.mjs .\test\v3-ui153-attendant-layout.test.mjs .\test\v3-ui154-attendant.test.mjs .\test\v3-ui155-attendant.test.mjs .\test\v3-ui156-attendant-indicators.test.mjs .\test\v3-ui157-chauffeur-alignment.test.mjs .\test\v3-ui158-simple-driver-flow.test.mjs
node .\scripts\build-attendant-testhost.mjs
# Garder la procédure Gradle existante :testhost:assembleDebug et installer seulement sur A2S_Scola_Phone_Stable
```

**Statut :** sources et tests de code enregistrés sur branche de test; APK UI-158 non encore construit ni installé.
