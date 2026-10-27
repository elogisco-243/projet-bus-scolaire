# A2S Scola UI-177 — Adapter pour interfaces complètes
La priorité est la connexion des **interfaces complètes**, pas le remplacement des écrans par les pages de test UI-168. Le nouveau module `mobile-session22/full-interface-adapter.mjs` classe certaines actions existantes de l'interface Accompagnateur UI-170 et les opérations Chauffeur pour préparer la future passerelle sécurisée.
Il n'est pas encore importé par `mobile-session19/app.mjs`, et n'émet **aucune commande réseau**. Les actions de Chauffeur simulées dans l'écran Accompagnateur restent bloquées comme confirmations croisées réelles. Le vrai Chauffeur et l'Accompagnateur devront émettre leurs propres événements depuis des sessions distinctes vérifiées.
UI-170 reste intacte. Les interfaces complètes Parent et Superviseur, l'authentification institutionnelle et la synchronisation opérationnelle sont encore à construire et intégrer.
Tests : `node --test test/v3-ui177-full-interface-adapter.test.mjs`.
