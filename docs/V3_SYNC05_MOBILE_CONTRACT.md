# A2S Scola — SYNC-05 : contrat de synchronisation mobile

**Prototype isolé, NON relié à l’APK UI-145 ni à Render.**

- Le transport prévoie POST `/api/v3/sync/events` et GET `/api/v3/sync/trips/{uuid}/snapshot`. URL HTTPS et jeton sont injectés ; aucun endpoint réel ou secret n'est codé en dur.
- Les événements reprennent exactement le format de la file mobile : `id, tripId, studentId, stopId, type, occurredAt, status, attempts`.
- Le pointage garde son identifiant stable pendant les réessais ; l'accusé serveur doit confirmer cet identifiant et un numéro de séquence.
- `401`, pannes réseau, `429` et `5xx` conservent le pointage en attente. Un `409` bloque la tentative pour rapprochement manuel, sans inventer de confirmation.
- Les autres événements `stop_arrival`, alertes, accidents, urgences restent en attente de leur API future, sans être envoyés à l'API des élèves.
- Les références locales `A-01` et UUID de démonstration réservés sont refusés : mapping approuvé nécessaire avant toute communication opérationnelle.
- Le rôle, l'identité du conducteur ou l'attestation de bus arrêté ne sont jamais transmis comme privilèges depuis le téléphone.

## Limites bloquantes

1. Aucun fournisseur OIDC réel et aucune connexion UI-145 à ce module. Aucun test sur deux téléphones physiques à ce stade.
2. Le stockage atomique et chiffré, le verrou inter-processus et les révisions sont à implémenter sur Android ; `localStorage` n'offre pas ces garanties.
3. L'API de snapshot est limitée aux données renvoyées par le serveur. Le client ne peut pas se substituer à ses règles parent–enfant.
4. `sequenceNo` est attribué **par enfant** et ne sert pas de curseur global. L'historique des événements est limité; une pagination/une révision globale sont nécessaires pour une synchronisation complète.
5. Une case « bus immobilisé » n'est pas une preuve physique ; l'attestation opérationnelle reste à concevoir et auditer.
6. Tester avec des élèves fictifs seulement; audit sécurité, identités OIDC, conformité données mineurs et base Render restent des étapes distinctes.

Ne pas fusionner dans `main`, ne pas compiler un nouvel APK et ne pas activer l'API Render.