# SYNC-18 — Profil Accompagnateur, validation isolée

Branche de travail basée sur SYNC-17 ; aucune fusion ni déploiement. Les règles de `mobile-session18/attendant-policy.mjs` sont une **barrière locale complémentaire**, jamais une autorisation serveur suffisante.

## Parcours à valider sur Android
- Connexion fictive via le même écran, attribution automatique du profil accompagnateur, affichage explicite « Démo — aucune transmission réelle ».
- Tournée assignée uniquement, présence de l'accompagnateur, refus des tournées d'autres équipages et organisations.
- Liste des références autorisées, pointage montée, doublon, élève absent, erreur de tournée, descente sans montée et descente répétée.
- Compteur embarqué exact, refus de confirmation « véhicule vide » si un enfant reste enregistré, contrôle final de tournée.
- Alerte incident (normal, urgence), suppression de toute impression de transmission réelle en démo.
- Réseau absent / restauré, fermeture puis reprise, idempotence des événements, état en attente et horodatage serveur.
- Interdiction de démarrer/conduire/terminer la tournée ou de modifier itinéraire, équipage, affectations.
- Même présentation mobile que Chauffeur, quatre menus et barre inférieure fixe, sans défilement involontaire sur « Ma tournée ».

## Limites et portes de validation
Les tests unitaires valident des règles pures avec objets fictifs. Ils ne prouvent pas l'intégration UI, le stockage local, les écritures RLS serveur, le GPS, l'émulateur ou les notifications. Le `frontend` historique n'a pas encore de rôle accompagnateur et ne doit pas être confondu avec l'APK SYNC-17. Mode opérationnel désactivé jusqu'à vérification end-to-end de l'identité serveur, autorisation, appareil, synchronisation durable et non-fuite entre environnements.

Exécution : `node --test test/v3-sync18-attendant.test.mjs`.
