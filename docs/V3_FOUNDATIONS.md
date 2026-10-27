# Bus scolaire V3 — Fondations (proposition technique, pas encore deploiement)

## Statut

Ces fichiers sont concus comme la **premiere livraison V3**. Aucun des nouveaux modules n'est encore branche au serveur V2 et aucune base de donnees Render n'a ete creee ou modifiee. Le serveur V2, sa route `/health` et son protocole Socket.IO restent inchanges.

## Modules et parcours cibles

1. **Ecole** : gestion des eleves (references opaques), affectations, itineraires, droits d'acces scolaires.
2. **Transporteur** : gestion des bus, chauffeurs, disponibilites et tournées, dans son organisation.
3. **Chauffeur** : consultation des trajets qui lui sont affectes ; emission GPS seulement durant son trajet actif.
4. **Parent** : suivi d'un trajet seulement apres verification formelle du lien parent-eleve ET affectation de cet eleve au trajet.
5. **Administration plateforme** : support et operations avec procedures elevees, auditables, a definir separement ; aucun passe-droit implicite n'est implemente.

## Vue du modele relationnel

- `organizations` : ecoles et operateurs de transport.
- `users` : comptes associes a un fournisseur d'identite externe, sans mots de passe stockes localement.
- `organization_memberships` : roles **actifs** par organisation ; un utilisateur peut porter plusieurs roles.
- `school_operator_agreements` : partenariat ecole-transporteur ; indispensable pour chaque itineraire.
- `students` : references opaques a des eleves (ne pas stocker de noms dans ce premier socle).
- `verified_parent_student_links` : relation parent-eleve prouvee, tracee et revocable.
- `vehicles` : bus rattaches au transporteur ; `routes` / `route_stops` : itineraires et arrets.
- `trips` : tournee planifiee, en cours, terminee ou annulee ; chauffeur et bus affectes.
- `trip_students` : eleves autorises sur une tournee.
- `audit_events` : historique minimal des actions sensibles.

## Securite multi-organisations

- Toutes les autorisations passent par le **contexte de session valide cote serveur** et des relations extraites de la base; jamais par des identifiants/roles annonces par le navigateur.
- Ecoles et transporteurs ne doivent acceder qu'a leurs propres ressources.
- Un parent doit appartenir a l'ecole concernee, avoir un **lien parent-eleve verifie et non revoque**, et son enfant doit etre inscrit sur ce trajet.
- Le chauffeur doit etre **membre actif** du transporteur ET etre affecte au trajet en cours pour publier du GPS.
- La simple possession d'un numero de bus ou de son identifiant ne donne **aucun droit**.
- Les utilisateurs non autorises sont refuses par defaut. Les operations admin globales devront etre separees et auditees.

## Interface backend future

Proposition, **non implementee** dans cette livraison :

- `GET /api/v3/me` : profil et droits scopes.
- `GET /api/v3/trips` : trajets visibles par acteur ; filtre et pagination.
- `GET /api/v3/trips/:id` : details autorises, sans donnees nominatives d'enfant par defaut.
- `POST /api/v3/trips` : creation si organisation, partenariat et ressources sont compatibles.
- `GET /api/v3/vehicles` : flotte vue selon le role.
- `POST /api/v3/parent-student-links/verify` : validation manuelle soumise a verification institutionnelle et audit.
- `WS /v3/trips/:id/position` : flux limite aux trajets actifs et autorises (a relier aux permissions V3 et au Socket.IO V2).

## Ordre d'implementation recommande

1. **Cette livraison** : migration SQL proposee + fonctions d'autorisation pures + tests independants.
2. Creer une base Postgres **de test separee** sur Render ; valider la migration, les FK, les requetes et les droits d'isolation.
3. Fournisseur d'identite avec sessions courtes, invitation/verification des responsables, revocation et audit.
4. Depot de donnees et services API ; ajouter tests de transactions croisees (bus d'un autre transporteur, eleve d'une autre ecole, etc.).
5. Relier les flux Socket.IO a l'identite serveur et aux trajets autorises, avec expiration et audit.
6. Interfaces admin/transporteur, chauffeur et parent ; gestion des connexions mobiles instables.
7. Tests de securite et charge, politique de conservation et consentement avant toute utilisation avec de vrais enfants.

## Pour tester ce lot sans Render

Depuis la racine du depot avec Node.js 22+ :

```bash
node --check src/v3/authorization.js
node --test test/v3-authorization.test.js
```

Puis `npm test` si les dependances V2 ont deja ete installees. La migration SQL **n'est pas executee automatiquement**.

## Integration GitHub

Creer la branche `feature/bus-v3-foundations` a partir de `main`, puis copier chaque fichier du paquet au **meme chemin** dans le depot. Le workflow CI actuel (`npm test`) decouvrira `test/v3-authorization.test.js` sans changer les scripts. Ouvrir une PR vers `main` **sans fusionner** avant revue.

## Limites et travaux bloquants avant mise en production

- L'isolation actuellement codee dans `src/v3/authorization.js` est une fonction demonstrative : elle ne remplace pas l'authentification et ne doit pas etre executee avec du contexte client non verifie.
- Les contraintes entre ecoles, eleves, bus, transporteurs et chauffeurs ne sont pas encore integralement forcees en base. Ajouter transactions, contraintes ou triggers et tests de non-contournement.
- Pas de base Postgres, authentification individuelle, routes API, interface, notifications, historique ou donnees reelles integrees a ce stade.
- Ne pas fusionner dans une branche de deploiement de production sans validation formelle.
