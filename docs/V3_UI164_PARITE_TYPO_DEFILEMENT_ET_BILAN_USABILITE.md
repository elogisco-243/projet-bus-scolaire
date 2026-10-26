# A2S Scola UI-164 — Parité de la typographie, « Terminus atteint » et bilan d'aptitude

## Origine
Après installation réussie sur Android 16 de l'APK TEST UI-163, l'utilisateur signale :
- Le texte sous **PROCHAIN ARRÊT** doit avoir exactement la même taille que sur la session **Chauffeur v1.7**.
- Le message **« Terminus atteint »** n'est pas visible en défilement.
- Peut-on conclure qu'A2S Scola est désormais pratique et maniable ?

## Référence réellement comparée
APK Chauffeur original transmis par l'utilisateur : `A2S-Scola_UI-145_20261021-232542-371_debug.apk`, paquet `cd.eneo360.busscolaire.v3`, **inchangé**.

Dans son fichier `assets/public/theme.css`, section **A2S SCOLA UI-132 AUTO SCROLL STOP NAME**, le libellé actif possède :
- `color:#ffe48a`
- `font-size:clamp(16px,4vw,20px)` sur téléphone ≤480px
- `font-weight:800`
- `line-height:1.2`
- `width:max-content; max-width:none; white-space:nowrap; overflow:visible; text-overflow:clip` sur le texte lui-même, **le parent** servant de masque de découpe.
- `animation:driver-stop-slide … ease-in-out 1s infinite alternate` seulement si le texte est mesuré plus large que son conteneur.
- Le JavaScript du Chauffeur calculait le dépassement par `el.scrollWidth - el.parentElement.clientWidth` et la distance de défilement.

## Défauts identifiés et correction en UI-164
1. L'Accompagnateur utilisait déjà une taille de police proche de la référence, mais **son élément de texte était limité à `width:100%; overflow:hidden; text-overflow:ellipsis`**, ce qui coupait les textes longs et empêchait l'animation.
2. L'affichage dynamique remplaçait le prochain arrêt par **ARRÊT ACTUEL**, y compris au terminus. Dès que le dernier arrêt est confirmé, la ligne devient maintenant **PROCHAIN ARRÊT / Terminus atteint**, y compris tant que la tournée n'est pas clôturée.
3. L'UI-164 utilise les **mêmes valeurs typographiques** relevées dans l'APK Chauffeur, avec largeur naturelle du texte et masque sur `.next-stop-info`.
4. Le JS relit la largeur à chaque rendu et changement de taille d'écran, et applique le mouvement si nécessaire. Au terminus, un petit déplacement est **volontairement visible même lorsque le texte tient dans la largeur**, pour satisfaire la demande utilisateur. Cette extension ne correspond pas mot pour mot au déclenchement original du Chauffeur.
5. Si **Arrêt express** recouvre l'accueil lors de la dernière arrivée, un petit **« Terminus atteint » mobile** est également affiché dans son en-tête. Au retour au tableau de bord, le libellé défilant principal reste visible.
6. Les animations sont arrêtées lorsque le système demande une réduction des mouvements.

## Preuves logiques
- `test/v3-ui164-stop-name-marquee.test.mjs` contient **9 cas** (taille/poids/teinte de police, gestion du texte long, arrivée au dernier arrêt, conservation jusqu'à clôture, mouvement calculé, mouvement en terminus et redimensionnement).
- `scripts/qa-ui164-windows.ps1` compile, installe, lance et capture UI-164 dans le paquet TESTHOST `cd.eneo360.busscolaire.v3.sync09.test`, sans écraser le Chauffeur.

Les tests sur code et sur machine ne démontrent pas à eux seuls que l'animation est correctement visible en pixels ; une capture de l'arrêt final **et** une observation pendant quelques secondes sont nécessaires.

## Peut-on conclure à l'aptitude pratique ?

**Non, pas encore.** Les essais à ce stade démontrent la **faisabilité et le bon comportement logique d'une démonstration**, pas la validation d'usage réel.

| Domaine | État | Preuve encore nécessaire |
|---|---|---|
| Compilation/install/launch Android 16 | Réussie UI-163 sur émulateur | Revalider UI-164 après modification |
| Logique simulée Chauffeur/Accompagnateur | Bonne couverture automatisée | Parcours à deux vrais comptes authentifiés |
| Montées/descentes 5/15/30/50 enfants | Tests du code réussis | Temps réel de manipulation sur appareil par des accompagnateurs |
| Typographie et défilement | Correction UI-164 développée | Validation graphique sur téléphones petits et grands/tablette |
| Absences et corrections | Simulation vérifiée | Scénarios physiques et erreurs adversariales en situation contrôlée |
| Changements d'arrêt par Parent et remises | Modèle DEMO isolé | Application Parent, service partagé, vérification du badge et audit signé |
| Réseau intermittent | Simulation limitée | Réconciliation authentifiée sans perdre une remise ni doubler un élève |
| Mise en service | **Non autorisée** | Protocole de sécurité enfant, autorités et responsabilités convenues |

### Recette pratique minimale proposée
1. Faire effectuer une tournée complète par un opérateur novice, sans instructions orales.
2. Simuler des arrêts de **5, 15, 30 et 50 enfants fictifs**, entrées mixtes et sortie ; chronométrer **le temps écran et le temps arrêt séparément** et relever les hésitations.
3. Inclure absence anticipée, absence tardive, mauvais arrêt, enfant manquant, erreur de pointage, terminal, coupure réseau et tiers non habilité.
4. Observer les mains et l'attention de l'Accompagnateur : pas de défilement long ni d'obligation de regarder en continu son écran, pas de validation de remise sans vérification physique.
5. Mesurer les erreurs, les saisies corrigées, l'oubli de pointage, les faux positifs, l'accessibilité, et la compréhension du statut « prêt à repartir ».
6. Tester ensuite deux vrais appareils et des sessions différenciées avec synchronisation et double contrôle : **bloquant avant usage réel**.

**Conclusion du lot :** UI-164 est candidat à validation visuelle et ergonomique sur l'émulateur, non homologué pour le transport d'enfants en conditions réelles. Branche `feature/bus-v3-sync18-attendant-qa` ; aucun changement de production.
