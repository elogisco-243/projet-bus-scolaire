# A2S Scola UI-175 — Prototype de journal durable local
La branche UI-175 conserve les interfaces complètes Chauffeur et Accompagnateur, le serveur Démo et la logique UI-170 sans modification.
Le module `mobile-session22/durable-journal.mjs` ajoute un journal de développement sur disque en NDJSON, avec empreintes SHA-256 chaînées et détection de modifications simples. Les tests vérifient le redémarrage, l'ordre des événements et la détection d'altérations.
**Ce journal n'est pas intégré au serveur UI-173/174**, ne stocke pas les sessions et n'est pas un stockage opérationnel.
Le chaînage local n'empêche pas un attaquant disposant de l'accès au disque de réécrire tout le journal. Il faut une base de données transactionnelle, un journal d'audit protégé, des sauvegardes chiffrées, une authentification institutionnelle, un système de révocation distribué et un protocole hors-ligne validé avant la mise en service.
Tests : `node --test test/v3-ui175-persistence-contract.test.mjs`.
