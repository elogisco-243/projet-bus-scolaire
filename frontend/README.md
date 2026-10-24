# Bus scolaire V3 — Lot 6 · Interfaces de démonstration

Ce module est une **maquette web autonome et interactive**, en français, avec **données 100 % fictives**. Il ne communique avec **aucun service externe**, ne connaît pas les tokens de la V2 et n'enregistre pas les changements dans PostgreSQL. Un changement de profil n'est **pas une authentification**.

## Démarrer sur Windows / PowerShell

Depuis le dossier racine du dépôt, Node.js 22+ :

```powershell
node frontend/server.mjs
```

Ouvrez ensuite **http://127.0.0.1:4173/** dans votre navigateur. Pour arrêter le serveur : `Ctrl+C`.

## Lancer les tests

```powershell
node --test frontend/test/*.test.mjs
node --check frontend/src/app.mjs
node --check frontend/src/domain.mjs
```

Le `npm test` existant peut également détecter les tests `*.test.mjs` selon la version de Node.js. Il n'est pas nécessaire de modifier `package.json` ni d'installer des paquets npm.

## Parcours à tester

1. **Administration scolaire** : consulter les tournées de l'école A, créer une référence fictive, constater que l'école B n'est pas visible.
2. **Transporteur** : ajouter un bus fictif ; modifier l'affectation d'une tournée planifiée ; clôturer un incident fictif.
3. **Chauffeur** : démarrer `TRIP-A` ; confirmer une prise en charge ; passer hors ligne ; progresser ; reconnecter ; terminer la tournée ; signaler un incident.
4. **Parent** : visualiser le circuit autorisé, consulter les notifications; signaler une absence **avant le départ** ; vérifier que le parent A ne voit pas les références du parent B.
5. **Réinitialiser** : l'icône en forme de flèche circulaire dans la barre supérieure recrée le scénario initial.

Les modifications sont partagées **entre les profils du même onglet** pour permettre la démonstration, mais ne persistent pas lors du rechargement. Aucune localisation réelle, nom d'enfant, téléphone ou élément de paiement n'est utilisé.

## Installation dans GitHub

Ajouter **uniquement** `frontend/` et `docs/V3_LOT6_INTERFACES.md` à la branche existante `feature/bus-v3-foundations` (PR 2 Draft). Ne pas remplacer `src/server.js`, `src/v3/`, `staging/`, `test/` ou `package.json`. Ne pas fusionner ni déployer vers Render.

## Sécurité et limites

- Les règles d'accès dans `frontend/src/domain.mjs` servent **seulement à tester l'interface**, pas à contrôler l'accès réel. Un utilisateur pourrait les modifier dans son navigateur.
- Le mode hors ligne est une **simulation de file locale en mémoire**, et non une synchronisation réseau robuste.
- Les arrêts et les pourcentages de parcours sont fictifs ; **ce n'est pas une carte GPS**.
- Les parcours de l'interface doivent être connectés ensuite aux API V3 avec OIDC, RLS PostgreSQL, audits, révocation et autorisations serveur validées.
- Aucun vrai compte d'administrateur, chauffeur, responsable ou enfant ne doit utiliser cette maquette.
