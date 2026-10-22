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


## 22 octobre 2026 — Variante CSS COMPAT préparée

L'utilisateur a tenté `-Mode Check` du paquet UI-147/SYNC-14. Le script a correctement refusé toute écriture :
```
Version CSS locale (SHA256): B5E929477F98F2FD2654595DEC24FAEBBDBB1A46E9EF7291A6CB8CF7CA7D2008
CSS UI-147 deja present: False
SHA256 attendu: 02E944691EDEF1F066C4AFC67446810ED13A665B5F18A450C7E28E8938A3D90D
VERSION_CSS_NON_RECONNUE - AUCUNE MODIFICATION (NE PAS FORCER)
```
Le SHA attendu correspond bien au `theme.css` de `A2S-Scola-Sources-SYNC-01.zip` (octets présents dans le paquet ancien) ; la copie D: de l'utilisateur contient une autre version déjà personnalisée. Relancer l'extraction vers le même `D:\A2S-Scola-SYNC14-Scripts` produit indépendamment `DOSSIER SYNC-14 DEJA EXISTANT`.

Un ZIP de correction nommé `A2SScola-SYNC14-CSS-COMPAT.zip` a été créé dans la conversation. Il contient le CSS de patch inchangé (SHA256 `DC56512D6347C76EDD3706BB6DA58B7347F4B424741545D53A9D95E83F0F2D99`) et un script PowerShell dont la liste explicite d'empreintes acceptées comprend également **uniquement** le SHA256 précis rapporté sur D: (B5E929...). Le script exige toujours le marqueur SYNC-10, la source UI-146, les ancres CSS UI-145, les sélecteurs équipe attendus, le SHA256 du CSS de patch, une sauvegarde et un rollback. Il n'autorise **aucun autre SHA** et n'a pas de mode `Force`. Le dossier de décompression est nouveau : `D:\A2S-Scola-SYNC14-COMPAT`, afin d'éviter le conflit existant.

**État : correctif de compatibilité créé, non encore exécuté sur Windows utilisateur. Pas d'APK reconstruit, aucune installation.** Ne déclarer UI-147 appliqué qu'après sortie utilisateur de Check puis Apply. Ne pas toucher à UI-145 original, au V2 main ou à Render ; aucun compte réel ni dossier de sources ne doit être publié.
