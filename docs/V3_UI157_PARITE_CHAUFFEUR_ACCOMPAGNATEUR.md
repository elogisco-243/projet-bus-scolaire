# A2S Scola — UI-157 — Alignement Chauffeur / Accompagnateur (TESTHOST)

**Portée :** branche `feature/bus-v3-sync18-attendant-qa`, APK isolé `cd.eneo360.busscolaire.v3.sync09.test`. **Chauffeur v1.7, main, Render et base opérationnelle inchangés.** Le présent lot regroupe les corrections demandées après UI-156.

## Référence d'apparence
Les captures Chauffeur v1.7 servent de référence de composition, d'intitulés, de couleurs et de tailles. Les vrais assets/SVG Chauffeur ne sont pas entièrement présents dans cette branche : la **parité pixel à pixel reste à vérifier visuellement** sur Android 16. Le lot reprend la même hiérarchie et ajoute des règles de compaction en portrait court.

### Carte « MA TOURNÉE »
- **Avant départ :** `À PRÉPARER` sur fond **violet neutre** ; **jamais vert**.
- **Après départ simulé effectif :** `● EN COURS` sur fond **vert**.
- **Après clôture :** `✓ TERMINÉE` sur fond neutre, et non vert « En cours ».
- Remplacer l'ancien signe `⌁` par un **SVG Wi-Fi** aux proportions communes à l'interface Chauffeur. Vert si `network === 'simulated-online'`, gris sinon. Ce n'est qu'un indicateur **de liaison simulée** : intitulé accessible et page Plus indiquent explicitement « sans serveur réel ». Ne jamais prétendre à une connexion effective avec les services opérationnels.
- Le texte sous « PROCHAIN ARRÊT » (ex. **Dépôt**) prend la couleur jaune clair `#FFE38A`, une taille renforcée adaptative `clamp(34px,8.3vw,54px)` (adaptation aux écrans compacts), graisse 850 et interligne 1.06. Ajuster seulement après comparaison réelle avec Chauffeur v1.7.

### Quatre gros boutons de Ma tournée
Reprendre exactement l'**ordre et les intitulés** de la session Chauffeur :

1. **DÉMARRER LA COURSE** : ouvre une préparation contextualisée. En démo, présence, sécurisation Chauffeur fictive et « Prêt au départ » sont contrôlées avant le départ synthétique. L'Accompagnateur **ne reçoit aucune autorisation réelle de départ de véhicule**.
2. **NOUVELLE TOURNÉE** : page informative. Une nouvelle affectation réelle dépend de la supervision. Le bouton « Nouvelle simulation locale » fonctionne uniquement après la clôture ; ne détruit pas une tournée simulée en cours.
3. **ARRÊT ATTEINT** : page informative : une arrivée réelle doit être confirmée par le Chauffeur. Un bouton explicite **« Simuler arrivée Chauffeur »** déclenche uniquement le scénario fictif de démonstration ; le pointage de l'arrêt actif s'ouvre.
4. **CLÔTURER LA COURSE** : ouvre la liste de contrôles de sécurité. Refus de clôture si élèves non justifiés, à bord, arrêts manquants, alertes ouvertes ou inspection finale absente.

Les icônes, proportions des quatre tuiles, couleur des tuiles et largeur 2×2 sont rapprochées de Chauffeur v1.7 ; les icônes demeurent des SVG recréés et nécessitent une comparaison photo côte à côte.

### Quatre menus identiques
**Ma tournée · Alertes · Équipe · Plus**.
- **Pointage** n'est plus un onglet : toucher la bulle « Élèves à bord » suffit pour voir les élèves et, à un arrêt actif, les actions de pointage.
- « Arrêts atteints » affiche la progression et l'arrêt en cours.
- **Plus** contient **Journal des tournées**, **Annonces vocales**, **Connexion et synchronisation**, dans le même ordre que le Chauffeur. Annonces vocales réelles indisponibles dans le testhost. Synchronisation strictement simulée : zéro événement transmis.
- Les six catégories d'alertes et leurs consignes de sécurité demeurent inchangées.

### Compact et accessible
- Menus inférieurs ancrés hors de la zone à défiler.
- CSS d'adaptation portrait bas `max-height:760px` pour tenter de conserver les quatre gros boutons visibles.
- Pas d'ajout de sous-texte permanent aux deux bulles UI-156.
- Pas de faux privilèges Chauffeur ni d'appel réseau, même si les boutons partagent le même intitulé.

## Cas de tests dos à dos
1. Avant départ : « À PRÉPARER » neutre chez l'Accompagnateur ; après départ simulé : « EN COURS » vert ; après clôture : neutre.
2. Toggle réseau fictif dans Plus, puis vérifier Wi-Fi vert/gris sans confondre connexion réseau et liaison réelle.
3. Vérifier couleur, taille et emplacement « Dépôt », icônes, quatre tuiles et quatre onglets à la même résolution que Chauffeur v1.7.
4. Touche « Démarrer » avant présence : page de préparation, départ synthétique refusé. Après présence, sécurisation fictive, switch : démarrage synthétique autorisé.
5. Touche « Arrêt atteint » : consultation d'état uniquement ; seule une action de simulation **explicitement nommée** confirme la progression de l'itinéraire fictif.
6. Arrivée simulée au Dépôt : bulle Élèves attire l'attention ; E-01 à pointer, puis disparition de l'attention. Aucun élève de l'arrêt suivant dans les commandes.
7. Reprise après pointage, arrivée à l'arrêt fictif A : E-02 à pointer. Arrivée au terminus : E-01 à descendre.
8. Les alertes critiques restent accessibles sans blocage par une fausse confirmation d'arrêt ; pas d'envoi réel.
9. « Clôturer » bloque les anomalies, puis propose l'inspection finale après tous les arrêts et élèves justifiés.
10. « Nouvelle tournée » ne remet pas à zéro une tournée en cours ; en démo une réinitialisation après clôture recommence une nouvelle simulation isolée.
11. Plus → Journal / Annonces vocales / Connexion : présentation homogène, pas de sync réelle.
12. Tester largeur et hauteur portrait téléphone puis tablette, quatre boutons visibles et barre basse stable.

## Validation effectuée / restant à faire
Les contrôles de source JS et scénarios fonctionnels simulés ont été exécutés dans un environnement d'inspection. **Les tests Node officiels sur le poste Windows, le build Gradle UI-157, l'installation Android 16 et la comparaison des captures ne sont pas encore confirmés.**

Chemin de compilation attendu :

```powershell
cd D:\A2S-Scola-UI153-Phone
git pull --ff-only origin feature/bus-v3-sync18-attendant-qa
node --test .\test\v3-sync18-attendant.test.mjs .\test\v3-sync19-attendant-demo.test.mjs .\test\v3-ui153-attendant-layout.test.mjs .\test\v3-ui154-attendant.test.mjs .\test\v3-ui155-attendant.test.mjs .\test\v3-ui156-attendant-indicators.test.mjs .\test\v3-ui157-chauffeur-alignment.test.mjs
node .\scripts\build-attendant-testhost.mjs
& "D:\Android\Gradle\gradle-8.14.3\bin\gradle.bat" -p "D:\A2S-Scola-UI153-Phone\android-sync07" :testhost:assembleDebug --no-daemon
```

**Verdict :** shell Chauffeur approximé et logique Accompagnateur DEMO préservée. **Non autorisé pour usage scolaire réel** en l'absence de synchronisation signée, authentification, contrôles de sécurité, suivi des élèves et secours effectifs.
