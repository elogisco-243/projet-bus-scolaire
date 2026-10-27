# Bus scolaire V3 — Lot 1 : fondations

Lot technique non deploye et concu pour etre ajoute au depot `elogisco-243/projet-bus-scolaire` sur une **branche distincte** `feature/bus-v3-foundations`.

## Contenu

- `docs/V3_FOUNDATIONS.md` : architecture, parcours cibles, securite et feuille de route.
- `db/migrations/001_v3_core.sql` : proposition de schema relationnel PostgreSQL (pas executee).
- `src/v3/authorization.js` : fonctions d'autorisation par ecole, transporteur, chauffeur et parent.
- `test/v3-authorization.test.js` : 9 tests unitaires de base avec Node.js.

## Tests

```bash
node --check src/v3/authorization.js
node --test test/v3-authorization.test.js
```

Tous les tests sont passes lors de la creation du paquet. Le workflow GitHub Actions existant lance deja `npm test` et detectera les nouveaux tests apres televersement.

## Publication

1. Sur le depot GitHub, creer la branche `feature/bus-v3-foundations` depuis `main`.
2. Extraire cette archive sur votre PC.
3. Televerser `docs/`, `db/`, `src/v3/` et `test/v3-authorization.test.js` **a la racine de la branche**.
4. Ne pas televerser le dossier racine de l'archive comme un dossier supplementaire.
5. Attendre les tests dans Actions puis ouvrir une pull request **sans fusionner** pour revue.

Ne pas remplacer le dossier `src` existant: ajouter seulement `src/v3`.
Ne pas remplacer le dossier `test` existant: ajouter seulement `test/v3-authorization.test.js`.

## Statut deploiement

Aucun changement ne doit etre effectue sur Render a cette etape. Les nouvelles fonctionnalites ne sont pas connectees au serveur V2, aucun compte reel n'est gere, et le SQL n'a pas ete execute. Ne pas utiliser avec des donnees reelles d'enfants.
