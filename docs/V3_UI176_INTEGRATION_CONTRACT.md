# A2S Scola UI-176 — intégration des prototypes de sécurité
Le module `mobile-session22/integration-gateway.mjs` appelle le serveur local UI-173/174 pour demander une décision d'autorisation UI-172 et écrit une trace minimale à l'aide du journal UI-175.
Le connecteur est **bloqué par défaut** et ne peut être activé que par `testOnly:true`. Il ne réalise **aucune action métier** et ne démarre aucun serveur public.
L'écriture du journal est requise avant la réponse autorisée (échec de journalisation = refus). Le journal de démonstration n'est toutefois ni cryptographiquement ancré, ni une base transactionnelle.
Les écrans complets Chauffeur et Accompagnateur, les autres profils et tous les APK restent intacts.
Ce module **ne garantit pas** d'authentification institutionnelle, de synchronisation hors ligne, de révocation distribuée ou de sécurité opérationnelle.
Tests: `node --test test/v3-ui176-integration-contract.test.mjs`.
