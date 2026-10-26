# A2S Scola — UI-163 — Arrêt express à forte affluence

**Statut : développé sur branche TESTHOST Accompagnateur DEMO seulement.** Le Chauffeur v1.7, l'APK UI-145, la production et Render ne sont pas modifiés. Il ne s'agit PAS d'une solution utilisable avec de vrais enfants ou vrais badges aujourd'hui.

## Pourquoi

L'ancien écran « Élèves à bord » affichait une liste complète à faire défiler. Pour 15, 30 ou 50 enfants au même arrêt, ce parcours absorbe trop d'attention et trop de temps. Le pointage doit laisser à l'équipage la priorité à la surveillance physique.

## Nouveau parcours

1. Le Chauffeur (simulé par le moteur DEMO) confirme **ARRÊT ATTEINT**.
2. **Arrêt express s'affiche immédiatement** dans la zone centrale, sans accès supplémentaire par le menu ni recherche dans une liste complète.
3. Trois compteurs simultanés : **descentes restantes**, **montées restantes**, **absences signalées** avant l'arrêt. Les absences préalablement déclarées ne sont pas re-pointées.
4. **Descentes d'abord**, puis montées. Un maximum de **4 élèves actifs** est rendu simultanément ; sur faible hauteur, 3 puis 2 sont visibles et le suivant remonte après chaque action.
5. Un geste individuel « Descendu » / « Monté » par enfant. Un « Non présenté » reste distinct d'une absence déclarée à l'avance et doit être tracé.
6. Une possibilité **Corriger le dernier** annule uniquement la dernière saisie admissible, à l'arrêt actif et pendant l'immobilisation. L'événement initial reste au journal, suivi de `pointage_reverted`.
7. Tant que l'effectif n'est pas réconcilié, aucune reprise n'est disponible.
8. **Une fois les pointages terminés, la reprise n'est jamais automatique.** Dans le TESTHOST, « Simuler reprise Chauffeur » est une étape explicite. Dans le futur mode opérationnel, la validation de la reprise appartient à un compte Chauffeur réellement authentifié.

Le retour au tableau de bord, la barre du bas et les quatre gros boutons sont maintenus. « Élèves à bord » rouvre l'Arrêt express au lieu de la longue liste dès qu'un arrêt est actif.

## Situations extrêmes couvertes en tests

- 5, 15, 30 et 50 enfants attendus : file bornée, pas de liste longue à faire défiler pour retrouver le suivant.
- Plusieurs descentes et montées : descentes traitées en priorité.
- Absences signalées à l'avance : sorties de la liste active, maintenues dans le décompte.
- Enfant attendu mais non présent : action dédiée, journal local ; notifications réelles non implémentées.
- Erreur de pointage : seul le dernier événement local admissible est réversible, avec trace ajoutée.
- Alerte critique : pas de reprise tant qu'elle reste ouverte.
- Remise spéciale approuvée : l'interface l'indique. La machine d'état refuse un banal `alight` pour un enfant muni de `approvedChangeId`; le contrôle authentifié du badge et du récupérateur **n'est pas développé** dans le TESTHOST et l'élève reste sous responsabilité de l'équipe.
- Arrêt sans élève : l'écran affiche « Pointages terminés » mais ne simule aucun déplacement sans décision explicite.
- Fin de tournée : inspection finale, aucun enfant à bord, arrêts cohérents ; reprise et remise restent distinctes.

## Référence d'implémentation

- Interface : `mobile-session19/app.mjs` (file `expressRoster` / `expressPage`, ouverture immédiate après `simulate_arrival`, filtres Tous / Descente / Montée).
- Style : `mobile-session19/style.css` (affichage borné entre en-tête et navigation, `overflow:hidden`, trois paliers de hauteur, gros boutons tactiles).
- Machine d'état : `mobile-session19/attendant-demo.mjs` (action `undo_last_pointage`, blocage de remise spéciale sans vérification).
- Scénarios de tests : `test/v3-ui163-express-stop.test.mjs` (14 cas, dont simulations multi-effectifs et garde-fous), et anciens tests actualisés pour **ne plus valider une reprise automatique**.
- Installation de test : `scripts/qa-ui163-windows.ps1`. Exécute des tests Node ciblés, construit le package test isolé `cd.eneo360.busscolaire.v3.sync09.test`, vérifie AVD `A2S_Scola_Phone_Stable` sous Android 16, installe, lance et capture un écran.

## Vérification technique

CI GitHub « Bus v2 tests » : **349 tests au total, 343 PASS, 0 FAIL et 6 TODO** au commit `b8a7bafa6069b25ff3eed1e5f7505f4943ab71c1`, workflow `40303165819`. Ces tests comprennent 14 cas UI-163 plus les régressions précédentes. Les workflows PostgreSQL et RLS ont une portée séparée.

**Non validé sur Android à ce stade :** rendu graphique exact, orientation/tablette, surface tactile, taille réelle de l'écran compact, rapidité mesurée en conditions d'utilisation, lecteur QR/badge physique, vrai flux parent et synchronisation de deux téléphones.

## Bloqueurs de sécurité avant usage opérationnel

- Service partagé Chauffeur–Accompagnateur, authentification et rôles serveur ; arrivée et départ réellement validés par l'autorité habilitée.
- Arrêt sécurisé réel et capacité du bus ; « bus immobilisé » reste une déclaration de simulation sans capteur.
- Pseudonymisation et protection des données personnelles des enfants ; conservation, accès, traçabilité et chiffrement.
- Autorisations Parent demandées via A2S Scola Parent, approbation réelle de changement d'arrêt, preuves d'accusé et gestion des conflits.
- Authentification des badges/tuteurs et constat de remise physique, sans validation par simple checkbox.
- Essais humains supervisés, notamment arrêts très chargés, absences de dernière minute, enfants manquants, coupures réseau et erreurs de scan.

**Décision :** UI-163 est un progrès significatif en ergonomie DEMO, mais pas une homologation de l'exploitation.
