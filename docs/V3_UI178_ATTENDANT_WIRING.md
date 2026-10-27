# A2S Scola UI-178 — premier branchement à l'écran complet Accompagnateur
Cette version connecte réellement un contrôle local de classification à la gestion des actions de `mobile-session19/app.mjs`, sans modifier sa structure visuelle ni son réducteur de démonstration. L'import est relatif au répertoire `mobile-session19`, pour préserver le regroupement des ressources WebView/Android.
Ce contrôle est **passif et local** : il ne peut pas attester l'identité d'un Chauffeur, d'un Accompagnateur ou la confirmation croisée. La simulation locale reste identique. Le composant opérationnel est explicitement refusé et aucun appel réseau n'est ajouté.
**Attention :** lors du packaging Android, `action-boundary.mjs` doit être copié dans le même répertoire d'assets que `app.mjs` avant construction de l'APK. Sans ce fichier, le navigateur ne pourra pas résoudre l'import et l'écran ne s'affichera pas.
L'interface Chauffeur complète n'a pas été modifiée : son point d'entrée Android doit être identifié et testé séparément. Parent et Superviseur complets restent à développer.
Tests : `node --test test/v3-ui178-attendant-wiring.test.mjs`.
