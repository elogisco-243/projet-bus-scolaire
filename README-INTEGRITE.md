# Bus scolaire V3 — Lot 2 : intégrité multi-organisation

**Statut : fichiers préparés pour la PR Draft n° 2. Non déployés sur Render.**

Ce lot **ajoute** quatre fichiers, sans remplacer le code V2 et sans toucher à `main` :

- `db/migrations/002_v3_integrity.sql` : FK composites, typage école/transporteur et triggers sur trajets et liens parent–élève ;
- `db/tests/001_v3_integrity_regression.sql` : tests PostgreSQL exécutables en sandbox avec retour arrière des données d'essai ;
- `test/v3-cross-tenant.test.js` : tests Node.js supplémentaires sur les autorisations ;
- `.github/workflows/v3-postgres.yml` : tests de la migration sur PostgreSQL 16 jetable dans GitHub Actions.

## Vérifications disponibles

La suite Node.js se lance avec `npm test` et sera exécutée par le workflow GitHub existant. Le workflow séparé `v3-postgres.yml` démarre PostgreSQL 16 dans un conteneur jetable GitHub Actions et exécute les deux migrations, puis les tests SQL. **Ce workflow n'a pas encore été exécuté** : il sera déclenché seulement après publication dans la branche. Les tests SQL n'ont pas été exécutés sur une base réelle à la création de ce lot.

Pour vérifier les migrations dans une base PostgreSQL **de test vide et dédiée**, après sauvegarde :

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_v3_core.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_v3_integrity.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/001_v3_integrity_regression.sql
```

⚠️ **Ne jamais utiliser `DATABASE_URL` de production à la place de `TEST_DATABASE_URL`.** Les migrations DDL se valident en staging avant tout emploi réel. Le fichier de test rollback ses insertions, mais les deux migrations précédentes créent et modifient le schéma de test.

## Couverture et limites

Le serveur V2 sur Render reste fonctionnel ; les nouveaux modules V3 ne sont pas reliés au runtime. Le modèle bloque le mélange école/transporteur, les élèves externes sur un trajet et plusieurs désactivations incompatibles avec un trajet actif. Le déclencheur de vérification parent–élève exige un parent membre actif de la bonne école et un administrateur scolaire valide.

**Sécurité encore à compléter :** RLS PostgreSQL, rôle SQL applicatif sans droits DDL/contournement, validation serveur transactionnelle des affectations et des suppressions, révocation instantanée du flux Socket.IO, durée de conservation des positions et audit. La validation d'une base sur Render et la création de ressources cloud doivent être décidées avant exécution.

**GitHub :** déposer les quatre fichiers dans la branche `feature/bus-v3-foundations` à leurs chemins exacts, puis attendre GitHub Actions. Conserver la PR n° 2 en **Draft**, sans fusion.
