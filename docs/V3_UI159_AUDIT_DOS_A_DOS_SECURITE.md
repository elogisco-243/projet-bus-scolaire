# A2S Scola — UI-159 — Revue dos à dos Chauffeur / Accompagnateur

**Périmètre :** dépôt `elogisco-243/projet-bus-scolaire`, branche de test `feature/bus-v3-sync18-attendant-qa`, PR #19 brouillon. Date : 25 octobre 2026. **Aucun changement dans Chauffeur v1.7 installé sur téléphone, Android production, Render ni les données scolaires réelles.**

## Conclusion et niveau de preuve

- **Contrôles automatiques réels en CI GitHub : 294 tests répertoriés, 290 PASS, 0 FAIL, 4 TODO**, sur le commit `7f15cca1f310d055f01da4d85bdd6aa4c9bdc74f`. Workflow « Bus v2 tests » : https://github.com/elogisco-243/projet-bus-scolaire/actions/runs/40238054527
- Les workflows « Bus V3 - PostgreSQL Tests » et « Bus V3 - PostgreSQL RLS Tests » ont aussi réussi sur ce même commit. Ils ne prouvent **pas** une session opérationnelle commune sur deux téléphones.
- **26 scénarios PAIR/** ont été ajoutés dans `test/v3-ui159-side-by-side-safety.test.mjs`, combinant les règles d'un **ancien modèle Chauffeur de démonstration** (`frontend/src/domain.mjs`) et celles du **TESTHOST Accompagnateur UI-158/UI-159** (`mobile-session19/attendant-demo.mjs`). Ils ne sont **pas** un test E2E des deux APK v1.7 / UI-159 réellement synchronisés.
- L'utilisateur a confirmé auparavant la compilation et l'installation de UI-158 sur l'AVD Android 16. **UI-159 n'est pas encore compilée ni installée localement** ; la correction visuelle reste à vérifier en capture Android.

## Tests adversariaux ajoutés
- `test/v3-ui159-adversarial-invariants.test.mjs` : **10 séries de 420 actions aléatoires déterministes** (4 200 tentatives d'action : acceptées ou correctement refusées), pour vérifier la conservation du compteur à bord, l'ordre des arrêts, l'immuabilité des états, le contrôle des absences, le refus de fermeture prématurée et l'absence de transmission externe.
- Cas critiques supplémentaires : aucun départ malgré une alerte Enfant manquant ouverte ; confirmation explicite du bus immobilisé pour traiter cette alerte en Démo, puis retour au parcours simple ; aucune fausse inspection finale.
- **290 PASS ne veut pas dire 290 simulations de deux appareils**. La plupart des tests sont unitaires, DOM simulé ou règles serveur isolées.

## Correction principale (UI-159)
Défaut observé : le bouton « DÉMARRER LA COURSE » gardait un **fond gris-violet**, y compris quand le switch le rendait disponible. Cela provenait du CSS `.dashboard-actions .primary` statique ; la 4e tuile avait aussi un gris forcé `nth-child(4)`.
- **Démarrer disponible : violet soutenu.**
- **Arrêt atteint disponible (uniquement après départ, pas juste après switch) : jaune soutenu.**
- **Action réellement bloquée : gris neutre + `disabled` + `aria-disabled` + infobulle d'indisponibilité.**
- La simulation garde les 4 gros boutons et les 4 onglets Chauffeur ; la bulle « Élèves à bord » reste l'accès direct au pointage.
- L'arrêt intermédiaire **sans élève attendu** et la **reprise après résolution d'une alerte critique** n'immobilisent plus indéfiniment la Démo : reprise fictive seulement si les préconditions métier `canResume` sont satisfaites, sans commande de véhicule réelle.

## Parcours comparés et état des preuves

| Domaine | Chauffeur : prototype historique contrôlé | Accompagnateur UI-159 : Démo contrôlée | Verdict |
|---|---|---|---|
| Navigation | Chauffeur Android v1.7 : références par captures, code APK absent | 4 boutons, 4 onglets conformes en DOM ; CSS distinct actif/grisé | **UI à valider** avec captures de la vraie version Chauffeur |
| Préparation et départ | Prototype : `startTrip` exige affectation et réseau simulé | Switch unique de préparation démo, puis Démarrer direct | **Modèles testés séparément**, pas de validation croisée réelle |
| Arrêts | Prototype : `advanceTrip` progresse par incréments 25 % | Déclaration fictive sécurisée + trois arrêts, contrôle de doublons | **Schémas différents** (4 arrêts contre 3) |
| Pointage | Refus doublons et élèves d'une autre tournée | Montée/absence/descente par arrêt affecté, absence validée | **PASS simulé**, ne prouve pas de transmission inter-appareils |
| Incidents | Prototype : incidents disponibles, résolution par transporteur | Six catégories, criticité et blocage reprise, aucun secours externe | **PASS simulé**, envoi réel non activé |
| Clôture | **Faille identifiée sur prototype historique** | Refus s'il reste des enfants, des arrêts, des incidents ou si inspection bus absente | **Prototype Chauffeur non conforme** ; à ne pas utiliser comme modèle de sécurité |
| Réseau et reprise | Progression simulée en file locale sur prototype | Aucun réseau ni émission réelle sur TESTHOST | **Aucune synchronisation croisée prouvée** |
| Autorisations | Prototype : tour Chauffeur affecté et transporteur séparé | Règles DEMO / OPERATIONNEL distinctes, `authorizeAttendant` vérifie affectation | **Règles de base testées**, authentification serveur réelle non démontrée |

### Faille critique reproduite : prototype Chauffeur historique, PAS le Chauffeur v1.7

Séquence vérifiée sur `frontend/src/domain.mjs` :
1. `startTrip(...,'TRIP-A')`
2. `boardStudent(...,'ST-A')`
3. `finishTrip(...,'TRIP-A')`
4. Le résultat **autorise `status:'completed'` alors que `boarded.length===1`**.

Cette anomalie concerne **le prototype de démonstration historique présent au dépôt**, pas nécessairement l'application Chauffeur v1.7 installée. **Ne pas présenter ce prototype comme sécurisé ni comme preuve de conformité du Chauffeur Android.** La résolution requiert un modèle d'alight / inspection / validation croisée du Chauffeur (et les sources actuelles exactes), à ne pas substituer arbitrairement à la version stable.

## Quatre blocages de recette de sécurité

1. **Source et binaire vérifiable du Chauffeur Android v1.7.** Sans eux, impossibilité de valider l'exacte UI (tailles, icônes) et les scénarios Chauffeur mobile écran par écran.
2. **Deux sessions authentifiées sur une même tournée.** Les événements Chauffeur / Accompagnateur doivent être partagés, horodatés et soumis à une validation croisée serveur, notamment arrivée/immobilisation, départ, pointage, incident, clôture. **Aucun tel bout-en-bout n'est démontré**.
3. **Clôture réelle fiable.** Impossible de clore avec élève à bord, absent non justifié, incident ouvert, bus non inspecté ou information divergente entre appareils. La faille du prototype Chauffeur doit être corrigée sur un socle partagé avant toute réutilisation.
4. **Sécurité de production.** OIDC/JWT authentifiés, affectations et organisations vérifiées côté serveur, anti-rejeu/idempotence, protection des données des enfants et stockage, RLS/audit, sauvegarde/reprise, gestion réelle des alertes et appels secours hors app : contrôle encore nécessaire.

Ces contrôles figurent explicitement comme `test.todo`, **pas comme succès**.

## Règles d'usage à figer

- **Un seul parcours visible**, inspiré Chauffeur : switch → Démarrer → Arrêt atteint → Élèves à bord / pointage → Clôturer; les alertes restent accessibles.
- Aucun triple assistant de préparation, aucune validation fictive déguisée en signature réelle.
- Un bouton n'est coloré en actif **que si** la machine d'état accepte l'action ; gris pour indisponible. **« Arrêt atteint » reste indisponible avant le démarrage** même si la préparation est validée.
- Le pointage est explicite, jamais créé automatiquement. Les reprises automatiques UI-159 concernent seulement la simulation locale, après absence d'élèves attendus ou résolution des blocages.
- Pas de démarrage, arrivée ou clôture réelle sans preuve de Chauffeur / Accompagnateur et sans contrôle des arrêts/élèves ; jamais de faux « secours contactés ».
- Wi-Fi vert de la Démo = **liaison fictive affichée**, pas preuve de connexion serveur. Prévoir un état opérationnel distinct basé sur l'authentification et les accusés de réception réels.
- TESTHOST ne transmet aucune donnée élève, n'intègre pas de GPS réel, de notification fiable ni d'appels de secours.

## Prochaines preuves nécessaires

- Compiler la branche UI-159 et installer le nouveau TESTHOST Android 16, puis relever une capture écran avant et après le switch, après départ et après arrivée : violet/jaune actif vs gris inactif, sans défilement.
- Pour le **vrai dos à dos Android**, fournir le code ou l'APK Chauffeur v1.7 correspondant et un environnement de test à **deux profils**. Faire ensuite les scénarios de coupure/rétablissement réseau, équipe absente, élève manquant, incident critique, arrêt sans élève, doublons, clôture conflictuelle et inspection finale. **Jamais avec des élèves réels durant la qualification**.
- Ne pas fusionner PR #19 ni déployer tant que les quatre blocages ne sont pas levés.

**Statut global : Démo logique contrôlée, rendu UI-159 non encore vérifié sur appareil, production non homologuée.**
