# A2S Scola V3 — SYNC-02 : travail isolé

**Statut : proposition en cours, non déployée, aucun téléphone synchronisé.**

Cette branche dérive de `feature/bus-v3-foundations`, séparée de `main` et du backend V2.

Périmètre : rôle accompagnateur, affectations à la tournée, autorisation exceptionnelle du chauffeur seul, journal d'événements de montée/descente, dédoublonnage offline et protections parent–enfant.

La suite doit être soumise aux tests Node.js et PostgreSQL 16 sur une base éphémère CI. Les migrations Render, l'API V3 publique, l'authentification réelle et les écrans Android UI-145 restent inchangés.

Ne pas utiliser de vraies données d'enfants ni fusionner vers une branche de déploiement sans revue des politiques SQL, des droits d'écriture, de l'identité OIDC, de la protection des données et des scénarios hors ligne.
