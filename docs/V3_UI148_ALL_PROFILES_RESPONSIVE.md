# A2S Scola — UI-148 / SYNC-15 : un principe mobile commun à tous les profils

## Décision (22 octobre 2026)
- Les contrôles dupliqués doivent être supprimés de **Plus**. Le contrôle des annonces vocales appartient à la carte principale Ma tournée ; l'icône vocale doit être un vrai bouton pilotant `voiceOn`, pas simplement une décoration. Elle doit être désactivée pendant la conduite (course démarrée, bus non déclaré immobilisé).
- « Journal des tournées » devient la **dernière action de Plus**, après « Connexion et synchronisation » ; la suppression de l'action redondante ne doit pas conduire à inventer un troisième service.
- Le même principe de **respect de la barre d'état Android + en-tête visible + navigation basse ancrée + défilement interne en secours** s'applique à TOUS les profils mobiles existants : Parent, Chauffeur, Accompagnateur, Administrateur mobile ; les sous-pages comme Journal, élèves, itinéraires sont incluses. L'administration Web en largeur mobile et la connexion reçoivent aussi la marge supérieure.
- Conserver le rendu Équipe UI-147, déjà validé visuellement sur l'AVD Android 37. Ne pas modifier les rôles/droits, l'authentification réelle, la synchronisation sécurisée, Render ou l'original UI-145.

## Patch et distribution
- Ce dépôt contient le CSS exact sous `patches/ui148-all-roles-safearea.css` (miroir du fichier utilisé par le paquet Windows).
- Le ZIP livré dans la conversation `A2SScola-UI148-SYNC15-Tous-Profils.zip` contient `Appliquer-A2SScola-UI148-SYNC15.ps1`, CSS et fragments JS dont les SHA256 sont vérifiés par le script.
- Le script est **uniquement** pour la copie `D:\A2S-Scola-SYNC10-Test\mobile` et a deux modes séparés : `Check` en lecture seule et `Apply` après confirmation du diagnostic. Il exige le marqueur SYNC-10, le package Android `cd.eneo360.busscolaire.v3.sync10.test`, UI-146 JS et UI-147 CSS SHA256 `0F1295F8C7134245E824B1D5CBFB58E6FE20562BBB13ED2B19177600FAA09B75`.
- Le JS cible seulement le rendu chauffeur `tab==='more'`, l'icône vocale de la carte principale et son gestionnaire `voice-toggle` avec garde de sécurité. Le CSS vise les interfaces mobiles de tous les profils. Sauvegarde des deux sources `www/ui.mjs` et `www/theme.css` ; rollback si un contrôle échoue. Le script ne modifie pas les assets Android, ne construit et n'installe aucun APK.
- Le référentiel GitHub ne contient pas l'intégralité du projet `mobile/www` de l'utilisateur. **Il ne faut pas prétendre que le correctif a déjà été appliqué sur son PC.**

## Vérifications déjà exécutées (hors appareil)
- Transformation JS réalisée sur la source UI-145 fournie dans la conversation, avec application simulée du patch UI-146 ; `node --check` **réussi**. Aucun vrai identifiant ou enfant utilisé.
- Chrome headless Playwright a vérifié, sur gabarits isolés, le placement de l'en-tête (y≥29) et de la barre basse pour **4 profils** aux dimensions 320×568, 352×735, 390×844, 420×780 ; **16 vérifications réussies**, plus contrôle de la marge d'admin Web. Ces gabarits ne reproduisent pas nécessairement les écrans exacts de la WebView.
- Les tests ne remplacent pas le contrôle après recompilation sur `A2S_Scola_SYNC12_Test` ; ni les tests d'authentification, ni JS→Capacitor→SQLCipher en WebView réelle.

## Validation suivante
Recueillir sortie `Check` puis `Apply` dans D:, relire les nouveaux SHA256 (sans partager les sources) ; transférer **uniquement** `ui.mjs` et `theme.css` aux assets Android sous contrôle des anciennes empreintes, sauvegarder, recompiler l'APK et vérifier package/hash/signature. Installation **seulement** sur l'AVD de test après nouvel accord et audit. Captures par profil ; tester une navigation basse ancrée et la sécurité des annonces vocales avant tout départ. L'application UI-145 stable et Render demeurent inchangés.
