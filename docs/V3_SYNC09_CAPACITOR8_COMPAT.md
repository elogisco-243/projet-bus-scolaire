# A2S Scola — SYNC-09 : compatibilité native avec le projet Android réel

**Diagnostic local transmis le 22 octobre 2026, 12:31 (heure RDC). Aucune source Android locale modifiée par ChatGPT.**

| Paramètre | Projet Android local | Bibliothèque V3 SYNC-09 isolée |
|---|---|---|
| `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` | 8.5.3 | API Maven `com.capacitorjs:core:8.5.3` (compileOnly) |
| Gradle wrapper | 8.14.3 | CI Gradle 8.14.3 |
| Android Gradle Plugin | 8.13.0 | 8.13.0 |
| compile SDK | 36 | 36 |
| minimum SDK | 24 | 24 |
| target SDK | 36 | fourni par l'APPLICATION hôte, non imposé par bibliothèque |
| Java source/target | non définis dans l'inventaire local | 21 pour compiler contre Capacitor 8 |
| MainActivity package | `cd.eneo360.busscolaire.v3` | non modifié |
| MainActivity extends BridgeActivity | oui | registration EXPLICITE requise dans copie de test |
| Plugins enregistrés | non | aucun enregistrement automatique en V2/UI-145 |

## Vérifications de sécurité

- Le plugin SYNC-08 reste désactivé par défaut; il exige Android DEBUG, l'opt-in manifeste `org.eneo360.a2sscola.sync08.NATIVE_QUEUE_TEST_ENABLED` et le WebView local `https://localhost`.
- Le test du module n'est pas un test de migration des données locales : la file UI-145 et son `localStorage` restent séparés et ne sont jamais importés.
- L'identité/autorisation serveur V3 demeure désactivée : pas d'API de synchronisation activée sur Render, pas de synchronisation de deux téléphones réels.
- Ce changement ne crée pas d'APK de téléphone utilisateur et ne modifie ni `main` ni l'installation actuelle.

## Prérequis avant **intégration dans une copie Android de test**

1. Créer une copie indépendante sous `D:` (où il reste de l'espace), conservant sans toucher l'original local sous `C:`. Ne jamais copier les secrets, bases réelles, `node_modules` ou fichiers de signature dans des archives partagées.
2. Vérifier localement les fichiers `MainActivity.java`, `android/app/build.gradle`, `android/settings.gradle`, `android/app/src/main/AndroidManifest.xml` et la configuration Capacitor `webDir/server` sous contrôle de version ; hashes du diagnostic disponibles.
3. Le nouveau test APK doit employer un **applicationId distinct** (ex. `cd.eneo360.busscolaire.v3.sync09.test`) pour ne jamais remplacer UI-145. Pas de vrai compte, pas d'enfant réel.
4. Avant de raccorder le plugin, revoir l'enregistrement `registerPlugin(ScolaQueuePlugin.class)` avant `super.onCreate(...)` dans une classe MainActivity du clone TEST uniquement et vérifier le même id de plugin côté JavaScript.
5. Ajouter une matrice de tests instrumentés : protocole Capacitor 8, refus en release, origine WebView, verrou de session, conflits CAS, rotation/backup, crash et redémarrage. Des tests Gradle passants ne prouvent pas tout.

### Sources de référence vérifiées

- Maven Central `com.capacitorjs:core:8.5.3` : https://central.sonatype.com/artifact/com.capacitorjs/core/8.5.3
- Capacitor 8 Android : https://capacitorjs.com/docs/plugins/android
- Android Keystore : https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec
