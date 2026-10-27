# A2S Scola UI-173 : service de référence pour tests locaux
Le service `mobile-session22/auth-server.mjs` utilise des comptes d'essai injectés par un banc de tests, une dérivation scrypt avec sel aléatoire, des sessions aléatoires temporaires, un contrôle d'autorisation issu d'UI-172 et des événements d'audit en mémoire.
Il refuse sa création sans `allowLocalHttpForTests:true`, n'écoute que sur `127.0.0.1` et n'est pas intégré aux APK ni à la Démo UI-168.
**NE PAS EXPOSER SUR INTERNET, LE LAN, OU UTILISER AVEC DES DONNÉES RÉELLES.** Le paramètre d'activation pour tests peut être choisi par tout appelant du code : il ne constitue pas une sécurité de déploiement ni un véritable serveur de confiance.
Les indicateurs `serverVerified` sont construits par ce prototype après validation du mot de passe, mais n'attestent pas une authentification institutionnelle réelle.
Non implémentés : MFA, anti-bruteforce, journal durable, révocation distribuée, TLS, registre des établissements, signatures de tokens, gestion des secrets, réinitialisation sécurisée des comptes, vérification de l'identité réelle et autorisation de production.
Lancement des tests : `node --test test/v3-ui173-auth-server.test.mjs`.
