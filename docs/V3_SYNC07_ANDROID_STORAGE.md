# SYNC-07 — bibliothèque Android autonome de stockage chiffré

**Non installée dans UI-145 ; aucune compilation APK ; aucun déploiement Render.** Le dépôt GitHub ne contient pas encore le projet Android/Capacitor local. Le module sous `android-sync07/` est donc une bibliothèque Android autonome à intégrer après inspection des fichiers Android locaux.

## Implémentation native

- Java Android `SqlCipherQueueStore` utilise le SDK SQLCipher moderne (`net.zetetic:sqlcipher-android:4.17.0`) ; jamais SQLite non chiffré en repli. Min API 23.
- `KeystoreSqlCipherKey` génère un secret aléatoire 256 bits pour SQLCipher, le chiffre sous une clé Android Keystore AES-256-GCM NON EXPORTABLE avec IV aléatoire et AAD versionné, et conserve uniquement le secret enveloppé dans `noBackupFilesDir` grâce à `AtomicFile`.
- Le secret est récupéré uniquement lorsque l'alias Keystore est présent. Perte de clé ou restauration DB sans secret => échec fermé, jamais de nouvelle DB silencieuse ni effacement automatique des pointages.
- `SqlCipherQueueStore` conserve la queue JSON par clé de partition dans une base SQLCipher. Chaque `compareAndSwap` est atomique (`BEGIN/UPDATE revision/COMMIT`) et refuse une révision périmée.
- Un verrou OS `java.nio.channels.FileLock`, détenu jusqu'à `releaseLease`, empêche l'écriture concurrente par plusieurs WebViews/processus. Un jeton natif opaque de session est requis pour lire et écrire ; la durée de vie doit être limitée par le composant natif hôte (lifecycle).
- Les fichiers DB, WAL et secret chiffré restent dans le stockage `noBackup`; vérifier aussi la politique de sauvegarde de l'application hôte et supprimer toute restauration trans-appareil non prévue.
- `mobile-sync07/bridge.mjs` est le seul adaptateur JS prévu pour SYNC-06 ; il attend un plugin Capacitor réellement enregistré exposant `inspect`, `acquireLease`, `read`, `compareAndSwap`, `releaseLease`. **Ce plugin n'est PAS encore enregistré dans le projet Android local**.

## Ce que valident les tests

- Le CI compile `:storage:assembleDebug` avec Android SDK, Java 17 et SQLCipher ; cela ne produit pas d'APK.
- Les tests Node vérifient seulement le PROTOCOLE du pont JavaScript avec un plugin simulé. Ils ne prouvent PAS la protection Keystore ni la tenue aux coupures physiques. Des tests instrumentés sur émulateur puis matériel Android sont obligatoires.

## Pour l'intégration future

1. Vérifier `mobile/android` du projet local UI-145 (framework Capacitor, versions Gradle et minSdk) avant tout branchement.
2. Implémenter et auditer le véritable plugin Capacitor, avec contrôle d'origine WebView et de contexte d'authentification, restriction des capacités de lecture, fermeture et libération du verrou dans le cycle de vie.
3. Ajouter tests instrumentés Android : chiffrement du fichier, absence de clé en clair, panne avant/après COMMIT, clé perdue, concurrent multi-processus, stockage plein, restauration depuis sauvegarde.
4. Auditer la gestion des clés, la rotation/changement de compte, les règles d'effacement, le verrouillage d'appareil, les données des mineurs et la gestion des confirmations d'arrêt réelles.
5. Uniquement après autorisation explicite : intégrer dans un projet V3 Android séparé et tester avec élèves fictifs.

### Références techniques

- SQLCipher modern Android : https://www.zetetic.net/sqlcipher/sqlcipher-for-android-community/
- Android Keystore : https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec
- Android AtomicFile : https://developer.android.com/reference/android/util/AtomicFile
