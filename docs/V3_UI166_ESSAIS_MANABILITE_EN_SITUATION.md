# A2S Scola UI-166 — Essais de maniabilité sur arrêts à forte affluence

## Objectif

Compléter la recette technique et visuelle UI-165 par une **recette d'utilisation humaine**, effectuée uniquement en **DEMO**, avec des élèves fictifs. Le chauffeur v1.7 fourni à titre de référence reste inchangé. La partie opérationnelle n'est **pas prête pour le transport de vrais enfants**.

## Ce qui est développé (DEMO uniquement)

Depuis **Plus → Essais de maniabilité (Démo)**, un utilisateur peut charger directement un arrêt fictif à tester, sans perdre du temps à préparer un parcours complet :
- 5 élèves : **1 descente, 3 montées, 1 absence signalée** (4 gestes à effectuer).
- 15 élèves : **5 descentes, 7 montées, 3 absences signalées** (12 gestes).
- 30 élèves : **10 descentes, 14 montées, 6 absences signalées** (24 gestes).
- 50 élèves : **16 descentes, 24 montées, 10 absences signalées** (40 gestes).

Ces répartitions sont **des scénarios de simulation**, pas des données statistiques ni des effectifs d'établissements réels. Les identifiants sont `TEST-001`, etc. Chaque scénario charge directement le second arrêt, *Arrêt fictif A*, avec un véhicule **déclaré sécurisé par simulation locale uniquement**, des enfants déjà présents à bord pour les descentes et des absences anticipées.

L'écran affiche toujours un maximum de quatre élèves actifs, les descentes d'abord. Les élèves confirmés quittent immédiatement la file ; le prochain remonte sans défilement. Le bouton ordinaire ne peut pas enregistrer une remise spéciale sans vérification. Le dernier pointage peut être corrigé avec événement compensateur. La reprise du Chauffeur n'est pas automatique.

En fin de pointage, l'écran indique **l'intervalle entre le premier et le dernier geste de saisie**, ainsi que le nombre de corrections. Ces informations ne sont pas envoyées à un serveur et ne constituent **ni le temps d'arrêt total**, ni une mesure de prise en charge physique.

## Comment tester (Android 16)

1. Exécuter `scripts/qa-ui166-maniabilite-windows.ps1` dans le dépôt sous `D:\A2S-Scola-UI153-Phone`. La branche doit être `feature/bus-v3-sync18-attendant-qa`.
2. Le script lance les tests, construit/installle l'APK `cd.eneo360.busscolaire.v3.sync09.test`, vérifie l'émulateur `A2S_Scola_Phone_Stable` / API36 et prépare la fiche de mesures.
3. Dans l'application, ouvrir **Plus → Essais de maniabilité (Démo) → 5 élèves**. Le chargement remplace la tournée fictive précédente.
4. Observer les élèves fictifs et effectuer les actions individuelles « Descendu » puis « Monté » selon leur statut, en **vérifiant leur identifiant**. Ne jamais pointer un enfant seulement parce que le bouton est disponible.
5. Relever l'intervalle affiché après le dernier geste, le nombre de corrections, et mesurer séparément, au chronomètre externe, le temps d'arrêt complet d'un exercice réaliste.
6. Recharger ensuite les scénarios de 15, 30 et 50 élèves. Répéter sur un autre format d'écran (téléphone compact et tablette), puis avec un autre opérateur novice dans un exercice encadré.
7. Compléter la fiche `Captures-UI166\Fiche-maniabilite-UI166.csv`. Les champs d'observation sont **volontairement laissés vides** avant l'essai.

## Comment conclure

Il faut observer, au minimum :
- Les identités fictives peuvent être reconnues sans hésitation et sans tap erroné ; le pointage ne doit pas détourner durablement l'attention de l'enfant.
- Les compteurs montées, descentes et absences restent compréhensibles lors d'un arrêt mixte.
- Les 40 gestes du scénario de 50 élèves ne nécessitent pas de faire défiler l'ensemble des 50 lignes.
- Aucun mouvement du bus n'est déclenché par le simple achèvement du pointage.
- Les actions accidentelles sont corrigeables et les incidents bloquent les suites dangereuses.
- La navigation, la lisibilité et la surface tactile restent acceptables sur téléphone/tablette.
- L'observateur note séparément **durée d'interaction**, **durée totale**, **erreurs de pointage**, **défilements nécessaires**, **aide requise** et **commentaires**.
- Tester plusieurs personnes et plusieurs essais ; ne pas fixer un objectif temporel arbitraire avant une première observation.

**Décision :** un résultat d'essai automatisé vert ou un chronométrage court ne suffit pas à valider l'aptitude opérationnelle. Sans synchronisation authentifiée Chauffeur / Accompagnateur / Parent, protocoles de remise, vraie gestion des badges, incidents et reprise hors-ligne sécurisée, la mise en service reste **NO-GO**.

## Traçabilité des sources

- `mobile-session19/usability-fixtures.mjs` : quatre jeux de données éphémères.
- `mobile-session19/attendant-demo.mjs` : export du scénario et machine d'état DEMO.
- `mobile-session19/app.mjs` : menu « Plus » et intervalles de pointage locaux.
- `mobile-session19/style.css` : boutons de choix accessibles et lisibles.
- `test/v3-ui166-usability-scenarios.test.mjs` : scénario d'arrêt mixte, 5/15/30/50, correction, compteurs, interdiction de départ automatique.
- `test/v3-ui166-windows-installer.test.mjs` : isolation de package et analyseur syntaxique PowerShell.
- `scripts/qa-ui166-maniabilite-windows.ps1` : recette Android 16 et fiche vierge de mesures.

Aucune modification de l'application Chauffeur v1.7, de la production ou de la branche `main` n'est prévue pour cette phase.
