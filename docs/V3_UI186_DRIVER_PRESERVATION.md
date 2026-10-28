# UI-186 — Préserver les deux profils développés

**Règle impérative :** ne reconstruire ni Chauffeur ni Accompagnateur à partir de la maquette simplifiée UI-185.

## Chauffeur
Conserver la version complète et déjà développée du Chauffeur comme base de mise à jour, notamment ses écrans, boutons, navigation, événements et comportements existants. La référence récupérée depuis l'APK UI-145 est historique et **ne prouve pas être la dernière version approuvée** : identifier précisément la source Chauffeur utilisée et validée avant tout raccordement. Le circuit adopté par le Chauffeur reste : LUB-014, Dépôt → Golf → Centre → École Horizon.

Intégrer de manière additive les protections communes UI-160/UI-182, sans éliminer les fonctions déjà opérationnelles. Procéder par tests de non-régression Chauffeur (départ, arrêt, incidents, pointage, équipe, clôture, nouvelle tournée) et captures Android.

## Accompagnateur
Ne modifier aucune ressource d'interface de la version complète UI-170/UI-178. Toute adaptation au circuit Golf doit passer par une source de données indépendante, validée, sans refonte de l'interface. Conserver ses actions et parcours distincts.

## Session commune
Un seul point d'entrée Android pour Chauffeur, Accompagnateur, Parent et Superviseur. Le chargeur lance chaque interface complète sans réécriture. Parent et Superviseur sont à développer progressivement à partir de la charte validée. Sélection libre autorisée uniquement pour Démo ; authentification serveur obligatoire pour Opérationnel.

## État et limites
Ce document consigne une décision de conservation ; il **n'implémente pas** encore le chargeur des deux interfaces validées et ne produit pas d'APK. Le moteur partagé inter-appareils et la validation croisée sécurisée ne sont pas réalisés.
