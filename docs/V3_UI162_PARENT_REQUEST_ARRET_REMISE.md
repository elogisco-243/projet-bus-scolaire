# A2S Scola UI-162 — Parent demande le changement d'arrêt de remise

## Décision fonctionnelle confirmée
**Le parent / tuteur légal habilité initie directement la demande de modification de l'arrêt prévu depuis A2S Scola Parent.** Il ne peut pas valider lui-même la modification. L'approbation automatique n'est possible qu'à travers un contrôle de politique *effectué par un futur service authentifié* ; un cas exceptionnel ou douteux est transféré à la supervision. Le Chauffeur n'est pas sollicité pendant la conduite.

Une demande de changement et la remise physique à une personne autorisée sont **deux événements distincts**. Un badge n'est pas une autorisation de changer un arrêt et ne prouve pas à lui seul l'identité physique du récupérateur.

## Parcours Parent à viser
1. Ouvrir l'enfant concerné dans A2S Scola Parent et demander « Changer l'arrêt de remise ».
2. Choisir un autre **arrêt préexistant sur le circuit** et une personne déjà habilitée à récupérer l'enfant.
3. Soumettre une demande identifiable et idempotente (et non modifier directement la tournée).
4. Voir le statut « En attente », « Approuvée », « Refusée » ou « Annulée ».
5. Sur approbation, afficher la nouvelle consigne **confirmée** chez l'Accompagnateur et dans le suivi Parent avec preuve de livraison/accusé.
6. À l'arrêt correct, présenter les justificatifs nécessaires ; l'Accompagnateur identifie physiquement le responsable et confirme la remise. **Aucun départ ne se déduit du seul pointage.**

Pour les familles : ne pas imposer la saisie répétitive de leur identité si une session sécurisée existe. Pour l'Accompagnateur : ne montrer, dans l'Arrêt express, que les enfants attendus à cet arrêt et les **changements approuvés**, avec alerte claire « Remise spéciale ».

## Règles de sécurité (à implémenter côté serveur avant opération)
- Identité forte Parent et habilitation active sur l'enfant, y compris gestion des restrictions légales, décisions de justice, délégations et révocations.
- Arrêt demandé en aval du bus et **non dépassé** ; heure limite et conditions de sécurité de l'arrêt conformément à la politique de l'établissement/transporteur.
- Nouvelle personne : aucune validation implicite ; le bénéficiaire doit appartenir à la liste de récupération active, ou suivre une procédure humaine stricte d'ajout.
- Dernière consigne **approuvée et accusée** seulement, avec version de tournée, anti-rejeu, idempotence et contrôle des conflits.
- Si la demande est encore en attente ou si le réseau n'offre pas la preuve nécessaire, **l'arrêt prévu antérieurement reste la seule consigne applicable**. Pas de libération silencieuse de l'enfant.
- Une fois une modification approuvée, son annulation ou remplacement requiert une nouvelle autorisation tenant compte de la progression et du statut effectif de l'enfant.
- À l'arrêt : bus déclaré immobilisé, arrêt effectivement atteint et contrôlé, badge ou titre authentifié + identité du récupérateur + constat de remise physique. Événements distincts « Descente », « Responsable identifié », « Remise confirmée » selon les besoins contractuels/âge.
- Non-remise et absence de responsable : enfant demeure sous la garde de l'équipe et le protocole de protection est déclenché.
- Si deux parents ou tuteurs ont des instructions contradictoires, suspendre l'automatisme et escalader selon les habilitations légalement applicables.
- Même après une remise confirmée, conserver uniquement les informations personnelles nécessaires et autorisées, avec accès contrôlé et durée de conservation limitée.

## Ce que contient réellement le code UI-162 dans GitHub
Nouveau modèle de démonstration **autonome**, `mobile-session20/parent-stop-change-demo.mjs`, sur la branche isolée `feature/bus-v3-sync18-attendant-qa`.
- `newParentChangeDemo()` : tournée et personnes **entièrement fictives**.
- `parentRequestStopChange()` : vérifie le parent, l'enfant, le tuteur, l'arrêt, les demandes concurrentes et les clés idempotentes. Enregistre une **demande en attente** et **ne modifie pas** l'arrêt actuel.
- `simulateAuthorizedReview()` : simule **explicitement** une décision d'un superviseur fictif et refuse les versions périmées, les changements d'autorisation et les arrêts passés. Cette simulation n'est **pas** une vérification de politique ou une approbation de production.
- `cancelPendingRequest()` : annule une demande avant approbation, sans changer la tournée.
- `viewAttendantDropoffs()` : liste les enfants selon l'arrêt **approuvé**, jamais selon une simple demande Parent.
- `simulateGuardedHandover()` : sépare l'événement de remise et impose en démonstration arrêt atteint, bus immobilisé, récupérateur habilité, badge vérifié, identification physique et remise confirmée ; aucune des cases seules ne suffit.
- `verifyOperationalStopChange()` : **refus permanent** tant que le backend authentifié n'existe pas.

Le test `test/v3-ui162-parent-stop-change.test.mjs` ajoute **19 scénarios exécutables** et **1 TODO opérationnel** (identité, autorisation automatique officielle, réseau, accusés croisés et contrôle des badges). Des scénarios couvrent approbation tardive, reprise d'une demande, parent non habilité, badge emprunté, restrictions, révocation, conflit de version et non-remise.

### Limites importantes
- **Aucune interface A2S Scola Parent Android n'a encore été construite dans ce lot.** Le modèle est un prérequis de conception et d'essais logiques.
- **Aucune liaison** du modèle Parent UI-162 à l'APK Chauffeur v1.7 ou au TESTHOST Accompagnateur UI-161 : **une demande Parent simulée dans ce module n'arrive pas automatiquement dans le bus**.
- Aucune authentification, signature, synchronisation serveur, lecture réelle de badge ou notification réelle n'est fonctionnelle.
- L'APK Chauffeur d'origine, la production, la base métier et la branche `main` restent inchangés.

## Résultats des tests sur la branche
GitHub Actions « Bus v2 tests » a rapporté **335 tests répertoriés / 329 PASS / 0 FAIL / 6 TODO** après ajout des tests UI-162 (run `40301030790`). Les workflows PostgreSQL/RLS sont distincts. Ces résultats sont des tests de code, pas une recette de deux profils connectés.

## Suite du développement
1. Réaliser la vraie page mobile Parent « Changement d'arrêt » sous un mode démo visible, *sans confusion avec la production*.
2. Adapter Arrêt express de l'Accompagnateur pour afficher les changements **approuvés** et la vérification du récupérateur en un minimum de gestes.
3. Développer un service de tournée partagé avec authentification, autorisations par organisation et parent-enfant, contrôle de version, événements et audit, et notifications avec accusés effectifs.
4. Réaliser des essais croisés sur deux sessions authentifiées et plusieurs scénarios extrêmes : 30+ élèves à un arrêt, demandes concurrentes, coupure de réseau, responsable différent, parent absent et enfant non remis.

**Statut : décision validée et garde-fous codés dans un modèle autonome DEMO ; déploiement et intégration réelle non autorisés.**
