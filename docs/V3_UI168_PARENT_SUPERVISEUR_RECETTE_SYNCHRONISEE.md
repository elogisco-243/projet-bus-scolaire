# A2S Scola — UI-168 : Parent, Superviseur et essai synchronisé

**Statut au 26 octobre 2026 :** quatre profils de démonstration reliés à un seul serveur HTTP local, testé par plusieurs clients. Il ne s'agit pas d'un backend opérationnel et aucune application mobile Parent réelle n'est encore livrée.

## Périmètre terminé pour la démonstration

Les écrans de navigation locale permettent d'ouvrir, chacun dans un onglet indépendant :
- **Chauffeur** : début de tournée, arrivée aux arrêts, reprise explicite, clôture fictive.
- **Accompagnateur** : préparation, pointage élève par élève, feu vert de l'arrêt, remise fictive après revue séparée.
- **Parent** : consultation de son enfant, demande de changement d'arrêt, suivi de l'état *en attente / approuvée / refusée*. Une deuxième session Parent permet de tester l'isolation entre deux familles fictives.
- **Superviseur** : suivi des demandes, approbation ou refus avec motif, réexamen en cas de concurrence, alertes critiques, contrôle fictif du destinataire, réinitialisation de la démonstration.

Le serveur unique `mobile-session21/demo-hub.mjs` :
- écoute **uniquement** `127.0.0.1:4177`, n'ouvre aucun accès réseau externe ;
- reçoit les actions HTTP des onglets, gère une tournée fictive partagée **en mémoire**, et renvoie les révisions actualisées ;
- attribue des jetons de session temporaires pour différencier les onglets, **sans vérification d'identité réelle** : chacun peut choisir librement son profil localement ;
- refuse les actions contraires au rôle déclaré dans la session de test ;
- bloque les commandes en double ou fondées sur une révision périmée ;
- est indépendant du serveur opérationnel, du Chauffeur v1.7 et des données réelles.

**Aucune donnée de vrai enfant, vrai badge, véritable autorisation parentale ou véritable remise n'est utilisée.** Les retours de l'interface sont actualisés par consultation périodique du serveur local. Ce n'est pas un mécanisme de synchronisation opérationnelle multi-établissements.

## Lancement Windows

Dans PowerShell, sur la branche `feature/bus-v3-sync18-attendant-qa`, actualiser le dépôt, vérifier la syntaxe PowerShell et lancer :

```powershell
Set-Location "D:\A2S-Scola-UI153-Phone"
git pull --ff-only origin feature/bus-v3-sync18-attendant-qa
powershell -NoProfile -ExecutionPolicy RemoteSigned -File ".\scripts\qa-ui168-sessions-synchronisees.ps1"
```

Le script lance les tests UI-167 et UI-168, démarre le service local s'il est absent, ouvre **quatre onglets** puis crée une fiche de résultat vierge :

`D:\A2S-Scola-UI153-Phone\Captures-UI168\Recette-synchronisee-UI168.csv`

Les cinq accès possibles :
- Chauffeur : `http://127.0.0.1:4177/?profile=chauffeur`
- Accompagnateur : `http://127.0.0.1:4177/?profile=accompagnateur`
- Parent de E-01 : `http://127.0.0.1:4177/?profile=parent`
- Parent de E-02 : `http://127.0.0.1:4177/?profile=parent2`
- Superviseur : `http://127.0.0.1:4177/?profile=superviseur`

Le script indique le PID du serveur local pour l'arrêter avec `Stop-Process -Id <PID>`. Lorsque le serveur s'arrête, la tournée fictive en mémoire disparaît.

### Test avec navigateur sur émulateur Android 16

On peut lancer le script avec `-OpenAndroidEmulator` pour utiliser `adb reverse tcp:4177 tcp:4177` et ouvrir le profil **Accompagnateur** dans le navigateur de l'émulateur `emulator-5554`, en parallèle des profils du PC. Il s'agit du **navigateur** Android qui participe à l'essai synchronisé : **ce n'est pas l'APK Chauffeur ni l'APK Accompagnateur Android qui se synchronise déjà**.

## Recette A — approbation et remise exceptionnelle

1. **Accompagnateur** : « Confirmer la préparation (démo) ».
2. **Chauffeur** : « Démarrer la tournée (démo) », puis « Arrêt atteint : Dépôt ».
3. **Parent E-01** : demander que E-01 descende à **Arrêt fictif A** au lieu du terminus. Le Parent voit **pending** ; le Superviseur voit la même demande, mais l'Accompagnateur conserve encore le terminus comme destination.
4. **Superviseur** : « Approuver (démo) ». Le Parent voit **approved_demo** et l'Accompagnateur voit maintenant la nouvelle destination. Si d'autres actions sont intervenues, cliquer d'abord sur « Réexaminer (démo) », puis approuver.
5. **Accompagnateur** : « Monté » pour E-01, puis « Arrêt prêt à quitter (démo) ».
6. **Chauffeur** : « Reprendre la course », puis « Arrêt atteint : Arrêt fictif A ».
7. **Accompagnateur** : déclarer E-02 « Non présenté ». Tenter la « Remise confirmée » de E-01 **avant** la revue : l'application doit refuser.
8. **Superviseur** : effectuer « Revue simulée » du destinataire de E-01. **Cela ne prouve aucun badge ou visage réel.**
9. **Accompagnateur** : « Remise confirmée (démo) », puis « Arrêt prêt à quitter ».
10. **Chauffeur** : reprendre, atteindre le terminus ; **Accompagnateur** confirme l'arrêt prêt ; **Chauffeur** clôture avec l'inspection fictive. La tournée passe à **completed**.

## Recette B — refus d'une demande

1. Le Superviseur réinitialise le banc de test après confirmation.
2. Préparation et départ simulés, arrivée au Dépôt.
3. Le Parent E-01 demande encore le changement d'arrêt ; le Superviseur choisit **« Refuser (démo) »**.
4. Les deux sessions voient la demande refusée et l'Accompagnateur conserve la destination initiale, **Terminus fictif B**.
5. L'enfant n'est pas remis au nouvel arrêt sur la base de cette demande refusée.

## Recette C — sécurité et concurrence

1. Signaler un incident critique depuis le Chauffeur ou l'Accompagnateur : le feu vert d'arrêt doit rester bloqué.
2. Le Superviseur clôt la résolution **fictive** de l'incident ; l'Accompagnateur peut alors reprendre le processus de contrôle.
3. Rejouer une commande avec le même identifiant : une nouvelle application du même ordre doit être évitée.
4. Modifier la tournée dans un onglet alors qu'un autre possède une ancienne révision : ce dernier reçoit un conflit et doit recharger les informations.
5. Ouvrir le Parent E-02 : aucun détail de l'enfant E-01 ne doit apparaître.


## Recette D — absence anticipée et annulation Parent

1. Faire réinitialiser la Démo par le Superviseur pour obtenir une tournée nouvelle.
2. Depuis **Parent E-02**, utiliser « Signaler absent (démo) » **avant que la tournée atteigne l'arrêt de montée E-02**.
3. Ouvrir la session Accompagnateur : l'enfant apparaît avec le statut d'absence signalée, et il n'est pas ajouté aux élèves à pointer à l'arrêt de montée.
4. Vérifier que Parent E-01 ne peut pas signaler l'absence de E-02. Vérifier aussi que la déclaration n'est plus possible après le passage à l'arrêt ou après la montée de l'enfant.
5. Recommencer une tournée fictive ; Parent E-01 demande un changement vers l'arrêt A, puis clique sur « Annuler (démo) » avant la décision du Superviseur.
6. Vérifier que le Parent voit **Annulée**, le Superviseur voit la demande annulée et que l'Accompagnateur conserve la destination initiale.

**Limite importante :** une absence anticipée est déclarée par une identité parentale *fictive*. En production, elle ne devra être prise en compte qu'après une authentification Parent côté serveur et une validation de l'affectation parent-enfant.


## Résultats de recette transmis par l'utilisateur — 26 octobre 2026

### Test 1 — demande Parent approuvée par Superviseur

**Validé par l'utilisateur.** Confirmation reçue : « Test UI-168 réussi : le changement d'arrêt approuvé par le Superviseur est visible dans Parent et Accompagnateur. »

Cela confirme l'observation humaine d'une propagation de la décision sur les deux vues d'un même serveur local de démonstration. Cela ne prouve ni la robustesse hors-ligne, ni l'authentification des personnes, ni une synchronisation entre APK autonomes.

### Test 2 — refus du changement d'arrêt

**Validé par l'utilisateur.** Après le scénario où le Superviseur refuse la demande et où la destination initiale de l'enfant doit rester inchangée, l'utilisateur a répondu : « Confirmé ». Il s'agit d'une validation manuelle qualitative du parcours local fictif, sans relevé de captures ni preuve d'authentification opérationnelle.

### Test 3 — absence anticipée Parent E-02

**Validé par l'utilisateur.** Après le test où Parent E-02 annonce son absence avant départ, puis où l'Accompagnateur vérifie qu'E-02 ne figure plus parmi les élèves restant à pointer à l'arrêt fictif A, l'utilisateur a répondu : « Confirmé ». Cette validation porte sur la simulation multi-session locale, pas sur une application opérationnelle authentifiée.

**Non encore confirmés par l'utilisateur** : annulation de demande ; incident critique ; contrôle et remise simulée ; reprise réseau ; essais sur appareils distincts.

**Prochain essai** : incident critique : à l'arrêt fictif Dépôt, signaler un enfant manquant depuis Chauffeur ; vérifier le blocage du feu vert chez l'Accompagnateur et de la reprise chez le Chauffeur ; faire traiter l'alerte en simulation par le Superviseur ; vérifier qu'un nouveau feu vert explicite est nécessaire.

## Ce qui reste avant une synchronisation opérationnelle

- Identité réelle vérifiée, contrats Chauffeur / Accompagnateur / Parent / Superviseur et droits attribués **côté serveur**.
- Base de données transactionnelle de tournées avec révisions, événements horodatés et règles d'accès par établissement.
- Intégration effective des quatre interfaces aux applications distribuées et test entre vrais appareils.
- Vérification du destinataire par des moyens indépendants du client, consentements et révocations.
- Reprise après coupure réseau, gestion des conflits et procédures humaines en cas d'incident.

**Conclusion :** UI-168 permet une **recette synchronisée multi-session sur données fictives**, mais ne valide ni un déploiement ni le transport de vrais enfants. La production, `main` et le Chauffeur v1.7 restent inchangés.
