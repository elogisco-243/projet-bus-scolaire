# SYNC-11 — Test d'intégration JS↔Capacitor 8↔SQLCipher sur émulateur

Ce test est destiné uniquement au projet Android de démonstration `android-sync07/testhost`, jamais à UI-145 ni au serveur Render.

L'inventaire utilisateur sur la copie D: a confirmé les cinq contrôles structurels SYNC-10 : modules Gradle SQLCipher/Capacitor, `registerPlugin(ScolaQueuePlugin.class)` dans MainActivity, opt-in du manifeste DEBUG, `applicationId` indépendant. La compilation locale a réussi : `BUILD SUCCESSFUL in 2m 29s`, 68 tâches.

## Limite de ces contrôles
Ces confirmations **ne prouvent pas** qu'une page JavaScript puisse appeler réellement le stockage Android à travers Capacitor. C'est l'objet de SYNC-11.

## Scénario instrumenté
1. Démarrer le **testhost séparé**, applicationId `cd.eneo360.busscolaire.v3.sync09.test`, sur un émulateur API 36 avec Java 21, Capacitor 8.5.3, SDK36, AGP8.13/Gradle8.14.3.
2. `https://localhost` charge une page statique qui ne contient ni données d'enfants ni code réseau, et qui vérifie la présence du plugin natif.
3. JavaScript appelle `inspect()` et exige le provider `native_encrypted_sqlite`.
4. Créer une partition éphémère avec quatre UUID aléatoires ; acquérir un verrou natif ; lire `{revision:0,items:[]}`.
5. Écrire seulement la **file vide** avec une transaction CAS ; relire la révision 1 ; vérifier le refus du CAS périmé ; relâcher puis reprendre le verrou et vérifier la persistance.
6. Le test Android lit l'état final JavaScript via `WebView.evaluateJavascript`. **PASS** seulement si toute la chaîne JS→bridge→plugin→Keystore/SQLCipher→retour JS a réussi. Les échecs et délais provoquent une erreur CI.

**Important :** même avec PASS, ce test ne valide pas l'authentification réelle, la sécurité XSS, la synchronisation entre deux téléphones, les attestations d'arrêt physique, la rotation/perte de clés ou les cas de crash natif. N'utiliser que des identifiants et des données fictifs.

Référence : documentation Capacitor 8 pour plugins Android, https://capacitorjs.com/docs/plugins/android
