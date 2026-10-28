# UI-190 — Simplicité d'utilisation, sans perte de sécurité
**Version de référence :** UI-186 sur Android. Conserver sans changement `mobile-session19/app.mjs`, `style.css` de l'Accompagnateur et les ressources UI Chauffeur existantes. La couche UI-190 n'est pas branchée aux écrans et ne remplace pas le moteur UI-188.

Le nouveau module `mobile-session19/four-role-simple-actions.mjs` sélectionne une seule **action principale contextuelle** pour chaque profil à partir de l'instantané de démonstration. Il expose aussi quatre rubriques constantes : Ma tournée, Alertes, Équipe, Plus. Il n'exécute aucune action et ne supprime aucun contrôle.

- Chauffeur : sécurité véhicule, état de préparation équipe, départ, arrivée, pointage à traiter, reprise, confirmation de contrôle final, clôture.
- Accompagnateur : présence, préparation, attente départ, pointage ciblé à l'arrêt, contrôle bus vide et suivi.
- Parent : informations de son enfant et notifications pertinentes uniquement.
- Superviseur : vue des tournées, incidents ouverts en priorité et revue.
- L'interface existante Accompagnateur reste **intangible** ; une future implémentation peut simplement utiliser les recommandations dans les autres profils sans changer sa disposition.

## Limites
Les suggestions sont basées sur des données déclaratives de démo. Ce ne sont pas des autorisations métier : l'exécuteur UI-188 et ensuite le serveur décident de l'autorisation réelle. La validation d'une immobilisation physique n'est pas effectuée. Aucun nouvel APK n'a été construit. Les tests doivent être exécutés.

Test : `node --test test/v3-ui190-four-role-simple-actions.test.mjs`.
