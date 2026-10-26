# A2S Scola UI-155 — Rendement opérationnel Accompagnateur (DEMO isolée)

**24 octobre 2026 — branche de test :** `feature/bus-v3-sync18-attendant-qa`. **Application :** TESTHOST Android `cd.eneo360.busscolaire.v3.sync09.test`. Chauffeur v1.7 et Render non modifiés.

## Objectif
Réduire les manipulations et changements de menus sans réduire les gardes de sécurité. Une démonstration réactive n'établit pas à elle seule la sécurité d'un système réellement connecté.

## Interfaces conservées
- Même en-tête, style violet, formes, logo A2S Scola et navigation inférieure (Ma tournée, Alertes, Pointage, Équipe) que UI-154. Les symboles SVG demeurent une recréation ; **comparaison pixel à pixel avec les ressources Chauffeur originales non encore validée**.
- La grille principale **reste en 2 × 2** : Pointage des élèves, Validation croisée, Signaler un incident, **Suivi de tournée**.
- Les bulles « **ÉLÈVES À BORD** » et « **ARRÊTS ATTEINTS** » ouvrent leurs propres pages. Le bouton « Suivi de tournée » ouvre une **sous-page de résultats** ; rien ne se déplie sous les gros boutons.
- Six catégories d'alertes conservées à l'identique du Chauffeur : Embouteillage, Retard, Panne, Accident, Urgence médicale, Enfant manquant. Bandeau d'alerte active dans la carte de tournée, priorité visuelle aux critiques.

## Changements fonctionnels UI-155

### Préparation et départ centralisés
La zone « Prochaine action » de **Ma tournée** guide successivement : présence Accompagnateur → événement de sécurisation *fictif* du Chauffeur → switch « Prêt au départ » → départ *fictif*. Aucune navigation vers Équipe n'est nécessaire pour ce scénario. Le profil Accompagnateur **n'obtient aucun droit réel de conduite** : l'événement Chauffeur est un faux événement à seule fin de test.

### Arrêt et pointage contextualisés
À l'état « en cours », « Simuler arrivée à l'arrêt » enregistre un seul événement synthétique d'arrivée sécurisée, fait avancer la liste d'arrêts et ouvre **Pointage**. Les deux élèves fictifs ont chacun un arrêt de montée et de descente prédéfinis :
- E-01 : montée Dépôt (STOP-01), descente Arrêt fictif B (STOP-03).
- E-02 : montée Arrêt fictif A (STOP-02), descente Arrêt fictif B (STOP-03), ou absence simulée « Non présenté » à son arrêt de montée.

Seules les actions prévues pour l'arrêt actif sont proposées. Le trajet ne peut reprendre si un pointage attendu reste à effectuer. Le bus est réputé en mouvement après reprise fictive et le pointage est bloqué jusqu'au prochain événement simulé d'arrivée sécurisée.

### Alertes
Les urgences critiques (Accident, Urgence médicale, Enfant manquant) peuvent être déclarées localement pendant le déplacement ou avant départ. Elles n'exigent pas d'abord une confirmation d'arrêt. Les catégories non critiques ne sont autorisées qu'à l'arrêt sécurisé en simulation. Une alerte critique ouverte bloque la reprise; toute alerte ouverte bloque départ/clôture si applicable. Résoudre signifie uniquement **« traité en démo »**. **Aucun appel, message, notification, secours ni alerte serveur ne part de l'application.** En urgence réelle, la démo ne remplace jamais les procédures d'assistance.

### Clôture guidée
Sous-page accessible depuis Ma tournée / Pointage. Six contrôles : itinéraire achevé, tous élèves justifiés, zéro élève à bord, incidents traités en simulation, bus au terminus sécurisé, inspection de bus vide confirmée. Fermeture refusée tant qu'un contrôle est manquant. L'absence est marquée en démo avec motif fixé « Non présenté » ; les procédures opérationnelles exigent davantage de preuves.

## Évaluation du gain et critères mesurables

| Indicateur | Ancien parcours UI-154 | Nouveau parcours UI-155 | Qualification |
| --- | --- | --- | --- |
| Changements de menu pendant la préparation | Plusieurs allers-retours Ma tournée / Équipe | Aucun requis | Gain de conception, à mesurer sur appareil |
| Arrivée à l'arrêt + ouverture Pointage | Sécurisation fictive et itinéraire puis navigation vers Pointage | Une action synthétique et navigation automatique | Gain de conception, **simulation uniquement** |
| Erreurs de pointage au mauvais arrêt | Liste générique de deux élèves | Affectation par arrêt et restrictions métier | Test logique, pas encore terrain |
| Accès aux incidents critiques en mouvement | Bloqué par immobilisation simulée | Signalement local immédiat, sans vrai envoi | Test logique, n'assure pas la remontée réelle |
| Clôture avec élèves ou incidents non résolus | Contrôle partiel | Liste de six contrôles, refus sur anomalie | Test logique |
| Temps moyen, erreurs, satisfaction | Non mesurés | Non mesurés | Objectifs à évaluer avec utilisateurs |

**Cibles de futurs essais (pas des résultats constatés) :** un pointage normal en 1–2 interactions, zéro élève non justifié lors d'une clôture normale, aucune navigation superflue entre Ma tournée et Équipe, aucune alerte critique inaccessible pour raison d'état UI.

## Limites majeures
1. **Pas d'authentification réelle** ni d'autorisation serveur / RLS finale.
2. **Pas de validations croisées réelles** signées entre deux appareils; événement Chauffeur fictif manuel.
3. **Pas de données réelles d'élèves ni de GPS** fiable; arrêts et effectifs inventés.
4. **Pas de stockage durable, synchronisation chiffrée ni reprise garantie** après redémarrage.
5. **Aucun circuit de supervision ou d'envoi des alertes**, aucune prise en charge d'urgence réelle.
6. Aucun test E2E sur deux comptes, aucune qualification exhaustive des exceptions (remplaçants, absence de Chauffeur, élèves remis à la mauvaise personne, détours, panne, GPS indisponible).

## Vérifications de sources
- Tests UI-155 dans `test/v3-sync19-attendant-demo.test.mjs` et `test/v3-ui155-attendant.test.mjs`, complétés par tests UI-153/UI-154/SYNC-18.
- Tests logiques et contrôles de rendu en environnement JavaScript d'inspection : **57/57 tests existants (SYNC-18, parcours UI-155, UI-153, UI-154) réussis, et parcours DOM simulé réussi** lors de la rédaction. Il ne s'agit **pas** de la suite `node --test` sur Windows, ni du rendu final Android.
- **Pas encore de compilation ou installation Android UI-155** ; le dernier APK confirmé par l'utilisateur concernait UI-153.

## Réception sur A2S_Scola_Phone
1. Dans `D:\A2S-Scola-UI153-Phone`, récupérer la branche et lancer `node --test` sur les tests SYNC-18, UI-153, UI-154 et UI-155.
2. `node scripts/build-attendant-testhost.mjs`, puis Gradle 8.14.3 `:testhost:assembleDebug`.
3. Confirmer avec AAPT l'application ID `cd.eneo360.busscolaire.v3.sync09.test` ; installer **uniquement** sur l'AVD `A2S_Scola_Phone`.
4. Tester les scénarios parcours normal, mauvaise affectation, doublon, interruption réseau simulée, incident critique pendant mouvement, clôture bloquée, absence et arrêt actif.
5. Comparer capture par capture avec le Chauffeur v1.7 : logo, couleurs, symboles, typographie, tuiles, alertes, barra basse, écran non tronqué sur Pixel 7 puis tablette.
6. Garder PR brouillon, sans merge ni déploiement.

**Verdict :** meilleure ergonomie de la **simulation**, à mesurer après essais, **NON AUTORISÉ POUR TRANSPORT SCOLAIRE RÉEL**.
