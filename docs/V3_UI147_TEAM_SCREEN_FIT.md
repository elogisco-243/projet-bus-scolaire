# UI-147 / SYNC-14 — hauteur et zones sûres du menu Équipe

La capture du test Android 37 de l'utilisateur, après application de SYNC-13 (UI-146), confirme la disparition du bouton Retour et du menu déroulant. Cependant, les trois choix d'équipage **ne sont pas tous visibles sans défilement** sur la première capture ; la barre d'état recouvre du texte lorsque l'on fait défiler l'écran sur la seconde. Cette PR corrige **uniquement la mise en page de l'écran Équipe** sur les smartphones, sans changer aucun événement/contrôle métier JS.

## Patch cible

Fichier proposé : `patches/ui147-team-safearea.css`, à ajouter en fin de `mobile/www/theme.css` **uniquement dans la copie D: isolée** après vérification préalable. Le paquet de l'utilisateur contient un script Windows `Appliquer-A2SScola-UI147-SYNC14.ps1` (Check/Apply), un CSS identique et un README. Le dépôt GitHub ne contient pas `mobile/www/theme.css` réel ; aucune modification de source utilisateur n'est faite par ce commit.

- Réserver une marge supérieure de 30 px ou `env(safe-area-inset-top)` (la plus grande) pour que les icônes de statut Android ne chevauchent plus l'interface.
- Fixer l'en-tête dans un conteneur limité à `100dvh`, ancrer la navigation basse et confiner le défilement au contenu de l'écran Équipe.
- Répartir les trois choix sur **deux rangées** : « Avec accompagnateur » sur toute la largeur, « Chauffeur seul » et « Remplaçant » côte à côte ; laisser la confirmation directement visible, sans accordéon.
- Conserver un défilement interne de secours pour les très petits écrans ou l'accessibilité ; **ne pas cacher les commandes** en imposant `overflow:hidden` sur le panneau.

## Tests effectués hors ligne

Analyse de la syntaxe du CSS via `tinycss2`. Test de rendu sur un gabarit HTML statique reproduisant les classes de UI-146 avec Chromium headless aux tailles 320×640, 352×735, 360×740, 390×844 et 420×780. À 352×735, la confirmation du panneau termine à y=455, bien avant la navigation basse y=663 ; la barre supérieure commence à y=30. **Ces tests simulés ne remplacent pas un test dans l'APK de l'utilisateur et ne certifient pas toutes les polices ou tailles d'accessibilité.**

## Garde-fous

Le script PowerShell refuse d'écrire si le marqueur de copie D: est absent, si SYNC-13 n'est pas installé, si la version CSS d'origine ne correspond pas à SHA256 `02E944691EDEF1F066C4AFC67446810ED13A665B5F18A450C7E28E8938A3D90D`, ou si le CSS fourni ne correspond pas à SHA256 `DC56512D6347C76EDD3706BB6DA58B7347F4B424741545D53A9D95E83F0F2D99`. Sauvegarde datée et restauration en cas d'échec. **Aucun APK compilé, aucune installation et aucune modification sur UI-145 ou Render.**

## Vérification à venir

Après Check/Apply volontaire sur D:, propager uniquement `theme.css` à l'actif Android de la copie, recompiler, revérifier ID, hash et signature, puis installer uniquement dans l'AVD de test et obtenir une capture sur la même taille d'écran. Sans données réelles et sans démarrage de tournée.
