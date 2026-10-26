# SYNC-19 — Testhost Android Accompagnateur (démo isolée)

Ne pas remplacer l'APK UI-145, UI-149 ou l'application principale. Ceci utilise **uniquement** le package testhost `cd.eneo360.busscolaire.v3.sync09.test` déjà prévu par le dépôt. Aucune modification Render, API, production ou vraie donnée enfant.

## Sur la copie GitHub de la branche SYNC-18

Depuis la racine du dépôt, sur Windows avec Node.js 22+ :

```powershell
node --test test/v3-sync18-attendant.test.mjs test/v3-sync19-attendant-demo.test.mjs
node scripts/build-attendant-testhost.mjs
cd android-sync07
.\gradlew.bat :testhost:assembleDebug
```

Si le dépôt ne contient pas de `gradlew.bat`, utiliser un Gradle compatible déjà configuré localement (ou Android Studio), sans inventer une validation. Le répertoire `testhost/src/main/assets/public` généré peut être reconstruit. Installer l'APK **testhost** seulement sur l'émulateur de test, jamais sur un appareil en production. Vérifier d'abord son applicationId avec `aapt dump badging`. Les services opérationnels restent désactivés.

## Critères manuels
- Quatre onglets fixes sur petit téléphone (320dp, 360dp, 411dp), orientations et clavier; la page interne peut défiler, la barre du bas non.
- Démo clairement indiquée, même lorsque le réseau simulé est « connecté »; pas de requêtes réseau.
- Équipe: confirmer présence; Ma tournée: lancement simulé; Pointage: montée puis descente de E-01 et E-02; confirmation du véhicule vide et clôture.
- Tester doublons, enfant non monté, clôture avec enfant à bord, alerte, réseau simulé coupé, réinitialisation.
- Tester arrêt/redémarrage: toute donnée est volatile; ne prétendre à aucune reprise durable.
- **Aucune validation réelle** tant que l'authentification, les autorisations serveur, les tests Android instrumentés et la synchronisation sécurisée ne sont pas achevés.

## Note d'intégration
Le testhost est un support Android de démonstration, pas l'APK UI-149 installé. Les deux versions restent distinctes et la session opérationnelle n'est pas activée.
