# A2S Scola — SYNC-10 : copie locale d'essai sur le disque D:

**Statut : préparation isolée. Aucune action à distance n'est possible sur le PC de l'utilisateur et aucune source UI-145 n'a été modifiée.**

## Environnement confirmé

Le 22 octobre 2026, l'inventaire Android local indiquait Capacitor core/android/cli 8.5.3 ; Gradle 8.14.3 ; AGP 8.13.0 ; Android compile/target SDK 36 ; minSdk 24 ; MainActivity.cd.eneo360.busscolaire.v3 extends BridgeActivity sans plugin enregistré. SYNC-09 (PR 11) a validé un hôte TEST autonome sous cette pile sur l'émulateur API 36.

## Plan local (intervention utilisateur explicite)

Le paquet ZIP de la conversation `A2SScola-SYNC10-Copie-D-Test.zip` contient un script PowerShell `Preparer-A2SScola-SYNC10.ps1` pour Windows, une documentation et un scénario de test Windows basé sur des fichiers fictifs. Le ZIP est fourni comme artifact de la conversation ; **il n'est pas stocké dans ce dépôt**.

Ce script possède deux modes distincts :
- **Prepare** : refuse un emplacement D: déjà existant, copie `C:\Users\Jean Michel M\Documents\bus-scolaire-v3-local\mobile` vers `D:\A2S-Scola-SYNC10-Test\mobile` avec exclusions standard de clés, BDD, caches, archives et `.env*`. Vérifie les empreintes SHA256 des fichiers essentiels avant/après. Clone cette branche GitHub sous `D:\A2S-Scola-SYNC10-Test\native-v3`.
- **Integrate** : refuse toute intégration sans marqueur de copie isolée et sans structure de MainActivity / applicationId prévue. Agit **seulement** dans `D:\A2S-Scola-SYNC10-Test\mobile` ; ajoute les modules Gradle SYNC-09 copiés sous android/sync10, un enregistrement du plugin dans la MainActivity de copie, une autorisation de variante DEBUG seulement et un applicationId distinct `cd.eneo360.busscolaire.v3.sync10.test`.

**Ne pas prétendre que le script a été exécuté localement ou testé sous Windows tant que le rapport et les sorties PowerShell utilisateur ne le confirment.** Le test Windows inclus dans le ZIP est un scénario fictif pour audit, pas un résultat CI validé.

### Commandes locales conseillées

Décompresser le ZIP sur D: puis, depuis le dossier contenant le .ps1 :

```powershell
& '.\Preparer-A2SScola-SYNC10.ps1' -Mode Prepare
# Lire D:\A2S-Scola-SYNC10-Test\Rapport-SYNC10.txt
& '.\Preparer-A2SScola-SYNC10.ps1' -Mode Integrate
```

Si une erreur de structure apparaît, s'arrêter et partager uniquement le message d'erreur, pas les fichiers sensibles.

## Garde-fous

Les copies locales peuvent contenir des informations sensibles même si les extensions courantes sont exclues ; **ne pas publier le répertoire D:** sur GitHub, dans le chat, ni en ZIP. Ne pas utiliser de vraies données d'enfants. Aucun token, clé de signature, BDD ou historique de pointage ne doit être transféré. Une variante debug distincte n'est pas adaptée à la production. Ne pas modifier `main`, Render, ou UI-145. Après le premier rapport local, vérifier Gradle/JDK avant toute compilation ou installation sur téléphone.
