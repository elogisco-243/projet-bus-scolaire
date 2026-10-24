# SYNC-08 — Adaptateur Capacitor de test Android

**Statut : code isolé, non inclus dans l'APK UI-145 et non déployé.**

Le plugin `ScolaQueuePlugin` expose uniquement cinq opérations de stockage local : `inspect`, `acquireLease`, `read`, `compareAndSwap`, `releaseLease`. Il appelle la bibliothèque native SQLCipher/Keystore SYNC-07, sans aucun appel réseau ni gestion de données d'élèves.

## Activation volontaire, uniquement dans une application TEST

La bibliothèque `android-sync07/capacitorbridge` ne s'enregistre PAS automatiquement. Après vérification de la version de Capacitor du projet local, un intégrateur devra, **dans une copie de test**, adapter l'Android Gradle local puis enregistrer le plugin dans `MainActivity` via `registerPlugin(ScolaQueuePlugin.class)`. Dans le manifeste de la même application de test, autoriser explicitement la métadonnée :

```xml
<application ...>
  <meta-data android:name="org.eneo360.a2sscola.sync08.NATIVE_QUEUE_TEST_ENABLED"
             android:value="true" />
</application>
```

L'app doit être construite en DEBUG (android:debuggable). La WebView doit être strictement sur `https://localhost` sans port. Toute application release, tout site distant et toute application n'ayant pas explicitement activé la métadonnée reçoit un refus. Le plugin est encore insuffisant pour une mise en production (protection XSS, identité native, lifecycle, limitation des tailles/capacités et intégrité de l'environnement à renforcer).

La passerelle JS `mobile-sync08/registration.mjs` nécessite **un enregistrement injecté** (ex. `registerPlugin` de `@capacitor/core`) et `enabled=true`, `mode=staging`, `platform=android`. Elle ne fait aucun import automatique dans `www`.

## Tests

Le workflow CI compile `:storage:assembleDebug`, `:capacitorbridge:assembleDebug` et `:storage:assembleDebugAndroidTest`. Les tests Node rejouent les contrats JS des SYNC-05 à SYNC-08.

Les tests instrumentés présents dans `storage/src/androidTest` **ne sont pas exécutés par une simple compilation**. Il faut une exécution séparée sur émulateur Android ou téléphone de test pour constater le chiffrement physique, le redémarrage de l'instance, les locks OS et les CAS. Les tests de crash réel, concurrent multi-processus, backup/restore et effacement/rotation de clé exigent des scénarios instrumentés complémentaires.

## Bloquants

1. Version Capacitor et fichiers `mobile/android` locaux non présents dans le dépôt GitHub : aucune modification de l'application actuelle.
2. Ne pas intégrer au `main` V2 ni à UI-145 sans revue technique.
3. Ne jamais utiliser de données réelles d'enfants avant OIDC, autorisations serveur Render auditées et protection des données des mineurs.
4. Ne pas monter d'API ni déclarer la synchronisation inter-téléphones active.
