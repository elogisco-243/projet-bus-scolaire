# Bus scolaire V3 — Lot 7 : interface de démonstration isolée

## Copier dans GitHub

Depuis la branche `feature/bus-v3-foundations`, créez manuellement une nouvelle branche `feature/bus-v3-lot7-ui`.
Copiez le dossier `frontend/lot7/` et le fichier `frontend/test/lot7.test.mjs` en conservant les chemins.
Ne remplacez aucun fichier V2, ni `frontend/src/`, ni `src/`, `staging/` ou `package.json`.

## Tester (Node.js 22+)

À la racine du dépôt :

```powershell
node --test frontend/test/lot7.test.mjs
node frontend/server.mjs
```

Ouvrez http://127.0.0.1:4173/lot7/ dans le navigateur.

## Limites

Maquette Web responsive testable sur navigateur mobile ; **ce n'est pas encore une application native Android/iOS**.
Le mode hors ligne est simulé en mémoire, non persistant. La synchronisation est simulée, sans réseau.
Aucune carte réelle, géolocalisation, identité ou notification push. Les droits d'abonnement sont des règles de démonstration : la production devra les imposer côté serveur.
Aucun déploiement Render ni migration PostgreSQL.
