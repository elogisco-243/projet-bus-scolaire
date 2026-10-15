# Bus scolaire V3 — Lot 6 : interfaces et parcours utilisateurs

**Statut : prototype local, non déployé, non fusionné.**

## Objectif

Livrer un premier flux utilisable dans le navigateur avec quatre espaces : administration scolaire, transporteur, chauffeur, parent. Utiliser des scénarios **entièrement fictifs** (Lubumbashi, RDC) et une interface légère sans service tiers.

## Couverture fonctionnelle

| Espace | Écrans | Actions locales |
|---|---|---|
| Administration scolaire A | Tableau de bord, références élèves, tournées, établissement | Créer une référence fictive rattachée à la seule école A |
| Transporteur A | Vue d'ensemble, flotte, affectations, incidents | Ajouter un véhicule, changer un chauffeur de sa flotte sur trajet planifié, clore un incident |
| Chauffeur A | Tournée, prise en charge, incidents | Démarrer, avancer, terminer, confirmer référence élève, signaler incident, simuler hors-ligne et synchroniser |
| Parent A | Suivi de circuit, références autorisées, notifications | Visualiser seulement son trajet, gérer absence avant départ et préférences d'alertes simulées |

## Cas de test transversaux

- Parents sans lien parent–enfant vérifié : aucun trajet visible.
- Un conducteur ne voit ni ne modifie les autres tournées.
- Un transporteur ne peut pas affecter un chauffeur d'un autre transporteur.
- Une référence enfant d'une autre école ne peut pas être embarquée.
- Mode hors ligne : position simulée localement évolutive, progression publiée au parent figée jusqu'à la reconnexion.
- Les nouvelles références ne créent aucun lien parent–enfant implicite.

## Scénario conseillé pour démonstration

Dans l'interface du chauffeur, démarrer la tournée A, progresser une fois, passer hors ligne et progresser une autre fois. Passer au parent et constater l'ancien pourcentage. Revenir au chauffeur, rétablir la connexion et repasser au parent : la progression publiée est maintenant à jour. Tester ensuite les absences et la prise en charge. Cliquer sur Réinitialiser pour recommencer.

## Frontière de sécurité

La simulation n'utilise ni cookies, ni `localStorage`, ni authentification, ni `fetch` externe. Les filtres d'interface sont une facilité **UX seulement**. **L'API serveur V3 et PostgreSQL RLS restent les seuls points de contrôle d'accès à prévoir pour la production**. Aucun rapport d'état UX ne vaut preuve de sécurité réelle.

## Intégration future

1. Brancher `GET /api/v3/me`, `GET /api/v3/trips` et `GET /api/v3/vehicles` derrière un fournisseur OIDC et un rôle SQL RLS limité.
2. Implémenter les écritures au serveur avec transactions, contrôle des liens parent–enfant, audit, idempotence et vérification des bus/chauffeurs.
3. Ajouter une véritable carte et du suivi GPS seulement après revue sécurité, consentement, rétention et publication contrôlée.
4. Tester les écrans sur Android à faible bande passante et lecteurs d'écran, puis valider avec écoles, transporteurs et représentants des parents.

**Ne modifier ni Render V2 ni Render V3 staging pendant ce lot ; PR V3 n° 2 reste Draft.**
