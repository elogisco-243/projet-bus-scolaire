# A2S Scola — UI-146 : Équipe sans étape superflue (lot test SYNC-13)

## Décision utilisateur réaffirmée (22 octobre 2026)

La page **Équipe** du profil Chauffeur doit présenter les décisions d'équipage **sans clic d'ouverture d'un volet**, et le bouton redondant **« ← Tournée »** doit être absent : le passage à Ma tournée s'effectue directement avec la barre de navigation basse.

La capture utilisateur du test sur Android 37 montre encore la ligne « ▼ Équipage et autorisations ». Cela viole l'accord UI antérieur, même si le panneau est initialement ouvert. Corriger ce comportement et ne pas substituer une simple expansion par défaut.

## Portée de la modification

Un paquet PowerShell autonome et sourcé à partir de l'archive UI-145 fournie dans la conversation, nommé **A2SScola-SYNC13-Equipe-Sans-Menu-Deroulant.zip**, propose un `Check` lecture seule puis un `Apply` explicite sur **un seul fichier** de la copie Android de test :
`D:\A2S-Scola-SYNC10-Test\mobile\www\ui.mjs`.

Modifications conceptuelles :
1. Supprimer le bouton généré par `tab!=='overview'&&tab!=='alerts'?btn('← Tournée','goto-overview',...)` dans le rendu chauffeur, sans supprimer la navigation basse.
2. Remplacer `<details class="crew-settings" open><summary>Équipage et autorisations</summary>` par un conteneur **statique** portant le même titre ; rétablir la fermeture de son conteneur, sans modifier les boutons et les gestionnaires métier.
3. Garder toujours visibles : **Avec accompagnateur**, **Chauffeur seul**, **Remplaçant**, ainsi que la confirmation applicable au mode sélectionné.
4. Ne modifier ni les règles de sécurité, ni les données de tournée, ni les gardes de pointage, ni les autres menus, ni `theme.css`, `main`, Render ou l'application UI-145 originale.

## Garde-fous

- Vérification obligatoire du marqueur SYNC-10 de la copie isolée sur D:, de la version UI-145 et de l'unicité de trois ancres textuelles ; fail-closed si elles ont changé.
- Sauvegarde datée de `www/ui.mjs` et restauration automatique en cas d'échec ; `node --check` avant et après application.
- Essai de la transformation sur l'extrait de source UI-145 préalablement fourni, avec analyse syntaxique `node --check` réussie ; **ce n'est pas un test d'exécution sur Windows/Android**.
- L'application actuellement installée sur l'émulateur n'est pas modifiée par le script ; `npx cap copy android`, compilation, nouvelle signature, contrôle SHA256, puis mise à jour de l'APK de test nécessitent une validation séparée.
- Ne jamais transférer sur GitHub ou dans les fichiers publics le dossier local `mobile`, les assets ou les informations d'élèves.

## Vérification fonctionnelle après une reconstruction autorisée

- Écran Équipe : plus de « Retour vers tournée », pas de `summary` repliable, trois boutons d'équipage visibles sans interaction préalable.
- Barre basse Ma tournée / Alertes / Équipe / Plus continue de naviguer.
- Sélection « Avec accompagnateur » reste cochée initialement et « Accompagnateur présent » reste conforme à l'état de test.
- Sans démarrer de course, ni pointer un élève, confirmer que les règles de sécurité continuent à bloquer les actions non autorisées.
- Sur petite hauteur d'écran, vérifier les espacements et la zone de statut Android : le présent patch ne change pas les règles de safe-area ni le défilement.

## Statut

Paquet préparé et vérifié sur la source de référence. **Pas encore appliqué sur le PC utilisateur** et aucun nouvel APK installé. Conserver le changement dans cette branche séparée, PR en brouillon. Ne pas fusionner sur `main`.
