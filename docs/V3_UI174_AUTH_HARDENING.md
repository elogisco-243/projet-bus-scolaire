# A2S Scola — UI-174 : renforcement local de connexion (prototype)
UI-174 ajoute au serveur de référence UI-173 un compteur de tentatives infructueuses par identifiant et un verrouillage temporaire configurable. Les mots de passe ne sont pas enregistrés dans le journal d'audit du prototype. Le contrat de contrôle des rôles UI-172 et la Démo UI-170 ne changent pas.

**Limites de sécurité :** compteur et audit en mémoire, contournables par redémarrage ou déploiement sur plusieurs serveurs. Il n'y a pas de TLS, MFA, magasin de sessions durable, anti-bruteforce distribué ni identité institutionnelle vérifiée. Le service reste restreint à 127.0.0.1 et aux comptes fictifs. Ne pas exposer à Internet, au LAN ou à des utilisateurs réels. Mode opérationnel désactivé.

Tests : `node --test test/v3-ui173-auth-server.test.mjs test/v3-ui174-auth-hardening.test.mjs`.
