# Projet Bus scolaire — V2 de demonstration

Prototype de suivi GPS multi-bus avec Socket.IO et Node.js 22+. Les acces sont cloisonnes par compte, role et identifiant de bus. Il ne s'agit pas encore d'un service de suivi reel d'enfants.

## Installer et lancer (PowerShell)

1. Installer Node.js 22 ou plus recent. Copier `.env.example` vers `.env`.
2. Generer deux secrets distincts : `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` (executer deux fois).
3. Remplacer `REPLACE_ME_DRIVER` et `REPLACE_ME_PARENT` dans `BUS_ACCESS_TOKENS` par les secrets generes. Faire de meme pour `SIM_DRIVER_TOKEN` et `SIM_PARENT_TOKEN`.
4. `npm install` puis `npm run check` et `npm test`.
5. Dans un terminal : `npm start` ; dans un second : `npm run simulate`.
6. Verification : `http://127.0.0.1:3000/health`.

## Protocole

Connexion : `io(url, {auth:{token:'VOTRE_TOKEN'}})`.

- Chauffeur : `driver:update_location` avec `{bus_id,latitude,longitude,timestamp?}`.
- Parent : `parent:join_bus_room` avec `{busId}`.
- Parent : `parent:leave_bus_room` avec `{busId}`.
- Reception : `parent:bus_location_update` avec `{bus_id,latitude,longitude,timestamp}`.
- Erreurs : `server:error` avec `{code}`.

## Securite et limites

- Les secrets ne doivent jamais etre commits dans GitHub. Garder `.env` prive.
- Serveur local par defaut (`127.0.0.1`) : ne pas exposer au public sans HTTPS/WSS, rate-limiting infrastructure et validation de securite.
- Les jetons sont statiques et definis manuellement. Avant usage reel : identites individuelles, rotation/revocation des acces, consentement et controles parent-enfant.
- Positions recentes par bus gardees en memoire pendant 5 minutes maximum pour l'envoi aux nouveaux abonnes. Pas de base de donnees ni d'historique.
- Le projet ne comprend ni carte, ni application mobile, ni administration, ni notifications.
- La protection Socket.IO ne remplace pas un audit de securite independant.

## Suite

1. Comptes, transporteurs, ecoles, bus, chauffeurs et parents dans une base de donnees.
2. Portail d'administration et ecrans parent/chauffeur.
3. Suivi, alertes, gestion d'horaires, zones et trajets.
4. Monitoring, tests de securite, retention et RGPD/droit local applicable avant deploiement.
