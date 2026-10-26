# A2S Scola — UI-165 — Première recette finale et bilan de maniabilité

## Décision préliminaire

**Démo technique : ACCEPTABLE COMME CANDIDAT À UNE RECETTE TERRAIN.**

**Ergonomie pratique : NON ENCORE VALIDÉE PAR DES ESSAIS HUMAINS.**

**Exploitation avec de vrais élèves : NON AUTORISÉE (NO-GO).**

La réussite des tests automatisés prouve la cohérence de scénarios simulés et la résistance à plusieurs erreurs, mais ne démontre ni l'absence d'erreur humaine ni la sécurité effective d'une remise d'enfant.

## Chaîne évaluée

- Chauffeur de référence : APK **v1.7 UI-145** transmis par l'utilisateur, inchangé.
- Accompagnateur : TESTHOST Android 16 (package isolé `cd.eneo360.busscolaire.v3.sync09.test`).
- UI-163 : **Arrêt express**, avec au plus quatre enfants actifs, pointage individuel, absences déjà signalées retirées de la file active, descente prioritaire et progression sans défilement d'une liste complète.
- UI-164 : police du nom de l'arrêt et défilement horizontal selon le Chauffeur, avec visibilité de **« Terminus atteint »** au dernier arrêt, y compris dans l'écran Arrêt express.
- Parent : demandes de changement d'arrêt et remises spéciales limitées à un **modèle de données DEMO autonome**. Pas de serveur réel ni de lecteur de badge authentifié.
- UI-165 : **nouvelle batterie de scénarios automatisés** et **recette Android assistée**, sans modification de la production.

## Couverture des nouveaux scénarios UI-165

| Scénario | Vérification automatisée | Limite |
|---|---|---|
| 5 élèves dont 1 absence anticipée | File limitée, montée individuelle, absence hors de la file, reprise explicitement déclenchée | Pas de mesure humaine |
| 15 élèves dont 3 absences | Idem | Pas de mesure humaine |
| 30 élèves dont 6 absences | Idem | Pas de mesure humaine |
| 50 élèves dont 10 absences | Idem | Pas de mesure humaine |
| 50 enfants embarqués puis remis à leur arrêt final | Contrôle des 50 montées, des 50 descentes, bus vide et inspection de clôture en DEMO | Aucune identité réelle contrôlée |
| Double arrivée/pointage au mauvais moment | Machine d'état refuse | Ne valide pas les capteurs physiques |
| Incident critique pendant le pointage | Reprise bloquée | Ne prévient pas de secours |
| Correction d'une erreur de pointage | Événement compensateur ajouté au journal | Le stockage est local à la DEMO |
| « Terminus atteint » et typographie | Présence et comportement du code vérifiés | Vidéo/capture Android nécessaires |

La suite complète GitHub, au commit `80f01341cacdccdf3ce8c729070e39a9e5ee3b8d`, a rapporté **373 tests, 364 réussis, 0 échec, 9 TODO**, run `40309945439`. Les TODO correspondent à des preuves/implémentations restant hors de portée de la simulation.

## Étape à faire sur l'émulateur (préparée)

Script `scripts/qa-ui165-recette-windows.ps1` — exécutable en PowerShell depuis `D:\A2S-Scola-UI153-Phone`, sur la branche `feature/bus-v3-sync18-attendant-qa`. Il :
1. vérifie la branche et le SDK autorisés ;
2. lance les tests automatisés et prépare les ressources isolées ;
3. compile l'APK TEST, vérifie son package et installe seulement sur l'AVD `A2S_Scola_Phone_Stable` Android API 36 ;
4. capture automatiquement l'accueil ;
5. vous invite à vous placer à un **Arrêt express**, puis prend une capture ;
6. vous invite à vous placer au **Terminus atteint** et à fermer l'Arrêt express pour voir le libellé principal, puis prend une capture et tente une vidéo de **9 secondes** pour vérifier le défilement ;
7. produit **`QA-UI165-Recette.json`** avec l'empreinte de l'APK et les chemins de preuve, plus une **`Fiche-maniabilite-UI165.csv`** vide permettant de mesurer réellement les temps de manipulation.

Les deux interactions au poste sont nécessaires pour capturer les vrais écrans ; le script ne simule pas une validation visuelle et ne publie aucun résultat d'ergonomie inventé.

### Chemin attendu des fichiers

`D:\A2S-Scola-UI153-Phone\Captures-UI165\`

Nom des éléments : `Accueil-*.png`, `01-Arret-express.png`, `02-Terminus-atteint.png`, `03-Terminus-animation.mp4` si l'enregistrement est supporté, `QA-UI165-Recette.json`, `Fiche-maniabilite-UI165.csv`.

## Grille d'acceptation de la maniabilité

**Ce que nous devons voir**, sans prétendre que c'est déjà testé sur le terrain :
- chaque étape de montée/descente se comprend sans explication prolongée ;
- un élève attendu est identifié en un regard, avec un bouton unique adéquat ;
- les autres enfants à traiter remontent sans défilement long ou recherche manuelle ;
- les absences anticipées sont correctement exclues du pointage, tout en restant dans l'effectif ;
- aucune remise spéciale ne se valide par un simple bouton « Descendu » ;
- les alertes bloquantes sont immédiatement compréhensibles ;
- aucun enfant ne disparaît des comptes par erreur, même après correction de pointage ;
- le Chauffeur confirme la reprise séparément du pointage ;
- sur un écran compact comme sur une tablette, police, navigation fixe, barre de progression et gros boutons restent lisibles et accessibles ;
- le bandeau **Terminus atteint** apparaît au moment prévu et son mouvement est perceptible lorsque les animations système sont autorisées.

**Mesures à réaliser** : temps de pointage par enfant et par arrêt (5/15/30/50 enfants fictifs), nombre de manipulations, défilements nécessaires, erreurs et corrections, besoin d'assistance, attention réellement accordée aux enfants. Sans ces mesures, la qualification « pratique et maniable » reste une hypothèse prometteuse, et non une conclusion.

## Blocages avant essai réel avec enfants

1. Authentification effective et partage d'un même trajet/élèves entre les téléphones Chauffeur et Accompagnateur.
2. Séparation stricte **DÉMO / Opérationnelle**, comptes, autorisations et audit serveur.
3. Réception et arbitrage des changements d'arrêt Parent réellement authentifiés, permissions sensibles et validation de réception par l'équipage.
4. Contrôle du badge/identité des responsables avec preuve de remise effective, protocole enfant non remis.
5. Résilience réseau, idempotence, conflits multi-utilisateurs, conservation/chiffrement des données.
6. Tests avec accompagnateurs et chauffeurs volontaires sur données fictives, puis évaluation sécuritaire encadrée et autorisations de l'établissement.

## Décision suivante

Effectuer la recette assistée et examiner les deux captures ainsi que la vidéo d'animation. **Clôturer le jalon « ergonomie DEMO » uniquement si les écarts visuels sont corrigés et si les tests d'observation humaine sont satisfaisants.** Maintenir le jalon « mise en service » bloqué jusqu'aux intégrations et validations de sécurité.

**Aucun commit n'a été fusionné dans `main` ; Chauffeur v1.7 et production inchangés.**
