# A2S Scola — UI-154 — Évaluation fonctionnelle Accompagnateur

**Périmètre :** branche brouillon `feature/bus-v3-sync18-attendant-qa`, application Android TESTHOST `cd.eneo360.busscolaire.v3.sync09.test`. Source de comparaison graphique : captures Chauffeur v1.7 fournies le 24 octobre 2026. Aucune modification de l'APK Chauffeur installé, de Render ou du backend opérationnel.

## Décisions de conception confirmées
1. Le **gros bouton « SUIVI DE TOURNÉE » reste dans la grille 2 × 2** de l'accueil. Son **résultat est déplacé dans une sous-page dédiée**, accessible par ce bouton, sans ajouter d'onglet inférieur.
2. Les deux tuiles **« ÉLÈVES À BORD »** et **« ARRÊTS ATTEINTS »** sont des boutons. Elles ouvrent respectivement liste des élèves affectés et itinéraire / historique d'arrêts.
3. Les onglets inférieurs demeurent **Ma tournée, Alertes, Pointage, Équipe**.
4. Les alertes reprennent les six types de la capture Chauffeur : Embouteillage, Retard, Panne, Accident, Urgence médicale, Enfant manquant. Même consigne initiale et bloc « Suivi des alertes ». Les symboles UI-154 sont des SVG recréés à partir des captures ; identité pixel-par-pixel à valider contre les fichiers source Chauffeur.
5. **« Élèves à bord »**, jamais « Enfants à bord ».
6. Le switch « Prêt au départ / Bus immobilisé et sécurisé » est interactif **uniquement dans la simulation**, et conditionné par présence + événement Chauffeur fictif de sécurisation. Aucun contrôle moteur/chauffeur réel n'est donné à l'accompagnateur.
7. Un départ en démo nécessite présence confirmée, véhicule sécurisé dans la simulation et switch activé.
8. Les pointages et signalements en démo sont refusés hors arrêt sécurisé (événement Chauffeur fictif). Chaque arrêt atteint nécessite une nouvelle sécurisation fictive.
9. La clôture en démo exige tous les arrêts atteints, aucune personne à bord, chaque élève justifié par absence ou montée+descente, contrôle final du véhicule vide. Tout nouveau pointage invalide le contrôle final.

## Évaluation du parcours complet

| Étape | Couverture UI-154 (DEMO) | Écart opérationnel |
| --- | --- | --- |
| Connexion / rôle | Compte fictif Accompagnateur; état isolé en mémoire | Authentification OIDC/JWT serveur, affectation bus/circuit/école, aucune bascule démo en réel |
| Préparation | Présence confirmable; fausse confirmation Chauffeur; switch conditionnel | Validation physique conducteur signée et visible sur deux comptes |
| Départ | Départ synthétique bloqué sans les prérequis | Départ réel validé côté serveur, fenêtre horaire, affectation équipage |
| Élèves à bord | Bouton ouvrant liste de 2 élèves fictifs, état mis à jour | Roster réel sécurisé, contrôle des autorisations, chargement complet |
| Pointage | Montée, descente, absence, doublons bloqués; stationnement simulé exigé | Codes/identité, notifications éventuelles, justifications d'absence, synchronisation et réconciliation |
| Arrêts | Bouton vers itinéraire fictif, avancement 0/3…3/3 | GPS, itinéraire source, arrivée au bon arrêt, validation Chauffeur |
| Suivi | Bouton principal préservé; résultats dans sous-page | Journal durable horodaté, accusés entre appareils, audits |
| Alertes | Six catégories Chauffeur; historique uniquement incidents; pas d'envoi | Gravité, escalade, notifications, procédures d'urgence, sécurité hors ligne |
| Équipe / validation croisée | Simulation explicite, aucun pouvoir de chauffeur réel | Approbations croisées réelles, règles de délégation, remplaçants, chauffeur seul |
| Clôture | Bus vide + tous élèves justifiés + route terminée | Inspection physique, signatures, exceptions tracées, preuve de remise des élèves |
| Hors ligne | Mode local simulé, aucun envoi ni file réelle | Persistance chiffrée, file idempotente, reprise et gestion des conflits |
| Redémarrage | Données en mémoire perdues (démo) | Historique résilient, reprise contrôlée et authentifiée |

## Risques et priorités

### P0 — Bloquants avant exploitation réelle
- Pas d'authentification opérationnelle complète ni d'autorisation backend par organisation et tournée.
- Pas de validation croisée entre comptes chauffeur/accompagnateur réellement synchronisée.
- La confirmation d'immobilisation est simulée : ni GPS, ni signal du chauffeur authentifié.
- Pas de journal durable chiffré, ni reprise sûre après extinction, ni protocole de synchronisation et conflits.
- Alertes non acheminées vers une supervision ; les urgences ne doivent pas dépendre d'une démo.
- Pas de rapprochement robuste des élèves attendus / montés / descendus / absents / remis; le motif d'absence n'est pas encore saisi; pas de gestion opérationnelle des exceptions.
- Aucune preuve d'essais E2E multi-comptes sur appareils réels avec contrôle sécurité et confidentialité.

### P1 — Essentiels pour réception fonctionnelle
- Comparaison pixel-à-pixel avec le code UI Chauffeur d'origine : gabarits, tailles, couleurs, icônes, accents, alertes, barre de navigation.
- Tester visuellement les sous-pages : élèves, arrêts, suivi, alertes, pointage.
- Gestion du changement de conducteur, de remplaçant et des circuits modifiés.
- Validation de la reprise après panne réseau, application fermée, redémarrage Android et batterie faible.
- Afficher causes de blocage conviviales (plutôt que codes techniques) et statuts distincts « en attente / validé / refusé ».

## Scénarios de réception DEMO sur A2S_Scola_Phone
1. Ouvrir Ma tournée : vérifier 4 actions, charte Chauffeur, terminologie « ÉLÈVES À BORD », nav basse ancrée.
2. Toucher les deux compteurs : liste élèves fictifs et itinéraire s'ouvrent et permettent retour ; pas de nouvel onglet.
3. Toucher « Suivi de tournée » : sous-page avec résultats, **aucun encart de résultats supplémentaire sur la page d'accueil**.
4. Avant présence et confirmation Chauffeur fictive : switch désactivé, départ refusé.
5. Dans Équipe, confirmer la présence puis simuler une sécurisation Chauffeur; basculer le switch sur Ma tournée, puis démarrer depuis Équipe.
6. Tentative de pointage pendant le mouvement fictif : refus ; simuler l'immobilisation, effectuer montée E-01 puis descente E-01, déclarer absence de E-02.
7. Consulter la liste « Élèves à bord » : compteur 0, états Descendu et Absent. Refaire un pointage identique : refus.
8. Consulter les arrêts : signaler une sécurisation fictive avant chaque nouvel arrêt, compter 1/3, 2/3, 3/3.
9. Ouvrir Alertes : six types identiques Chauffeur; tester refus quand non sécurisé, enregistrer un incident une fois sécurisé, voir historique.
10. Tester clôture prématurée (élève à bord / arrêt restant / élève sans statut / véhicule non sécurisé) : refus ; confirmer véhicule vide puis clôturer.
11. Couper le réseau simulé : aucun événement réel envoyé; ouvrir Suivi et vérifier le journal local.
12. Réinitialiser : retour aux données fictives de départ; tester portrait téléphone puis tablette.

## Niveau de validation constaté
- Examen des sources GitHub et **30 validations logiques ou statiques exécutées dans un environnement JavaScript de vérification** le 24 octobre 2026; celles-ci ne sont ni un `node --test` Windows, ni une compilation Android UI-154, ni un test appareil.
- APK UI-153 compilé par l'utilisateur sur Windows avec succès. **UI-154 n'a pas encore été recompilée/installée sur son émulateur**.
- Gardes d'isolation : TESTHOST seulement, démo locale sans réseau, pas de déploiement serveur, aucune donnée d'élève réelle.

**Verdict :** architecture de la démo améliorée pour une qualification fonctionnelle du rôle, mais **NON PRÊT POUR EXPLOITATION OPÉRATIONNELLE**. Conserver le PR brouillon, exécuter `node --test`, compiler TESTHOST, installer uniquement sur `A2S_Scola_Phone` et comparer les captures avant réception UI.
