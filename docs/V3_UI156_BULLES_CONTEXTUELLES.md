# A2S Scola — UI-156 — Bulles contextuelles, sans sous-texte

**Cible :** Accompagnateur DEMO sur le testhost Android `cd.eneo360.busscolaire.v3.sync09.test`.
**Branche GitHub :** `feature/bus-v3-sync18-attendant-qa`.
**Intégrité :** aucun changement au Chauffeur v1.7, à Render, à l'authentification opérationnelle ni aux élèves réels.

## Décision validée
- Dans les deux indicateurs de la carte « MA TOURNÉE », conserver uniquement l'icône, le titre, le compteur et la flèche de navigation.
- **Supprimer complètement** « Accès au pointage » et « Accès à l'itinéraire ». Ne pas les remplacer par une mention permanente.
- Maintenir la taille, l'emplacement, les marges et l'identité des deux bulles.
- La mise en évidence ne signifie **jamais** une arrivée réelle, une confirmation de bus immobilisé ou une notification envoyée.
- La bulle « Élèves à bord » mène à la liste et, à l'arrêt actif, aux boutons contextuels de pointage **sur la même page**, sans clic « Ouvrir Pointage » supplémentaire.
- La bulle « Arrêts atteints » mène à l'itinéraire et à la progression fictive.

## Matrice d'attention

| État de la tournée simulée | Élèves à bord | Arrêts atteints |
| --- | --- | --- |
| Avant départ | Affichage normal | Affichage normal |
| En mouvement, aucun arrêt actif | Normal | Normal |
| Première ouverture de Ma tournée après arrivée fictive sécurisée | Deux pulsations et pastille fixe **si un élève doit être pointé** | Deux pulsations douces |
| Pointage encore incomplet | Bordure colorée et petite pastille, **sans animation répétée** | Normal après ses deux pulsations |
| Tous les élèves attendus pointés pour cet arrêt | Normal | Normal |
| Prochain arrêt atteint | Nouvelle attention seulement pour le nouvel arrêt | Nouveau signal court |
| RAZ de simulation | Aucun signal | Aucun signal |

### Règles techniques
1. `indicatorAttention(d)` déduit l'état de l'attention à partir du résumé de la tournée. Pas de réglage manuel des compteurs ni des droits.
2. `pointagePulseSeenAt` mémorise le dernier arrêt déjà signalé par une pulsation Élèves. `stopPulseWaitingFor` mémorise la prochaine mise en évidence Arrêts. Les deux variables restent locales à l'interface DEMO.
3. CSS : deux cycles limités à 750 ms et 700 ms chacun, sans boucle infinie, sans changement de hauteur et sans décalage de la barre inférieure.
4. `prefers-reduced-motion:reduce` désactive les pulsations et conserve une indication fixe. `forced-colors:active` adapte la bordure.
5. `aria-label` contient le compteur et, le cas échéant, le nombre d'élèves à pointer ; les éléments purement décoratifs restent masqués à la synthèse vocale.
6. Le paquet Android testhost interdit les connexions réseau via CSP `connect-src 'none'`. Les incidents et pointages restent **locaux à la simulation**.

## Tests de réception ciblés
- Accueil avant départ : aucune mention secondaire et aucune bordure d'attention.
- Départ simulé puis première arrivée fictive : les deux bulles attirent brièvement l'attention; « Élèves » reste signalée si E-01 doit monter.
- Ouvrir **Élèves à bord** : liste + bouton **Monter E-01** immédiatement, sans ouvrir le menu Pointage.
- Après montée d'E-01 : compteur à 1 ; bordure et pastille disparaissent.
- Retourner à Ma tournée sans nouvel arrêt : aucune nouvelle pulsation Arrêts.
- Simuler arrivée à l'arrêt suivant : nouveau signal pour E-02, pas de signal inutile pour E-01.
- Après absence motivée d'E-02 : signal Élèves supprimé.
- Au dernier arrêt : signal de descente E-01 ; après descente, aucun signal.
- Ouvrir **Arrêts atteints** : 3/3 et la liste d'arrêts fictifs ; aucun déclenchement d'arrêt par la seule lecture.
- Vérifier portrait, tablette, réduction des animations et clics clavier/focus, et comparer les dimensions aux captures Chauffeur v1.7.

## Limites et travaux séparés
- **UI-156 traite les deux bulles et l'accès contextualisé au pointage.** Le reste de la navigation UI-155 (notamment le menu inférieur « Pointage » et les quatre grosses tuiles Accompagnateur) n'est pas encore converti au shell complet Chauffeur v1.7. Leur unification, souhaitée par l'utilisateur, reste un **chantier distinct**, pour préserver la stabilité des parcours déjà testés.
- La parité exacte des SVG Chauffeur et de leurs dimensions en pixels n'est pas démontrée sans comparaison depuis les ressources originales Chauffeur.
- Aucune synchronisation réelle entre sessions Chauffeur/Accompagnateur, ni réception d'une arrivée réelle, n'est encore fonctionnelle.
- L'APK UI-156 doit être reconstruit sur Windows ; aucune installation sur l'émulateur Android 16 n'est encore confirmée.

## Compilation locale
Dans `D:\A2S-Scola-UI153-Phone`, vérifier la branche courante, puis :

```powershell
git pull --ff-only origin feature/bus-v3-sync18-attendant-qa
node --test .\test\v3-sync18-attendant.test.mjs .\test\v3-sync19-attendant-demo.test.mjs .\test\v3-ui153-attendant-layout.test.mjs .\test\v3-ui154-attendant.test.mjs .\test\v3-ui155-attendant.test.mjs .\test\v3-ui156-attendant-indicators.test.mjs
node .\scripts\build-attendant-testhost.mjs
& "D:\Android\Gradle\gradle-8.14.3\bin\gradle.bat" -p "D:\A2S-Scola-UI153-Phone\android-sync07" :testhost:assembleDebug --no-daemon
```

**Réception :** tests Node officiels et APK dans `A2S_Scola_Phone_Stable` (Android 16), puis comparaison visuelle; ne pas fusionner le PR brouillon et ne pas publier.
