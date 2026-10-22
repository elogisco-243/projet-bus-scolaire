# UI-149 / SYNC-16 — Retour direct du Journal au panneau Connexion

## Signalement et preuve
Sur l'AVD Android de test après l'installation d'UI-148, le Journal des tournées du profil Chauffeur n'a pas de bouton de retour interne vers « Connexion et synchronisation ». L'onglet Plus n'est pas surligné lorsque `tab==='events'`, car la barre basse utilise directement `tab===id`. Deux captures utilisateur du 22 octobre 2026 illustrent ce parcours.

## Correctif limité
- Uniquement dans `function driver()`, ajouter en haut du Journal un bouton **← Connexion et synchronisation** (`data-action=goto-more-connection`).
- Dans le gestionnaire des actions, cette action revient à `tab='more'`, restitue le rendu et **ouvre le panneau `.driver-connection-details`**, avec focus sur son sommaire sans défilement forcé.
- Dans `mobileNav(role)`, seul le profil `driver` garde l'onglet **Plus actif** lorsque `tab==='events'`.
- Le profil Accompagnateur a également un onglet Journal (un autre `events`) : **ne pas y injecter** le bouton ni modifier sa sélection d'onglet.
- Aucun changement de CSS (UI-148 reste en place), de données de tournée, de commandes de synchronisation, de rôles ni de garde-fous liés à la conduite.

## Paquet ciblé
- Archive fournie dans la conversation `A2SScola-UI149-SYNC16-Journal-Retour.zip`, **SHA256 `75F0AAC0EB438337EE4828B1A6A1B7E3D0F294BF378F8EDBC196F7B762196289`**.
- Script `Appliquer-A2SScola-UI149-SYNC16.ps1` modes `Check` (aucune écriture, simulation en mémoire) et `Apply` (cible `D:\A2S-Scola-SYNC10-Test\mobile\www\ui.mjs` seulement, sauvegarde, `node --check`, rollback).
- SHA256 UI de départ **exact** `A6FDECB210E5B9DEFBB4371B07F1858358BB0C5DA19E404FF1F9B8E23C3559A6`, CSS inchangé requis `8C2E34542B50FB4E5475B3FB263284767404609B93BD6B669BF5C786BA5F82A6`. Un autre état échoue fermé sans écriture.
- La copie isolée D: doit avoir son marqueur SYNC-10, le package Android de test et tous les fragments d'ancres exacts. L'APK installé **n'est pas modifié par le paquet**.

## Tests hors Windows
- Source de référence recomposée UI-145+UI-146+UI-148: remplacements uniques dans la portée du Chauffeur, `node --check` réussi.
- Tests Node VM: action du bouton ouvre `more` et déplie Connexion, `Plus` actif dans le Journal du Chauffeur, `events` de l'Accompagnateur inchangé. **PASS**.
- La source Windows exacte n'est pas accessible à GitHub ni à ChatGPT ; l'intégration locale n'est pas encore confirmée.

## Validation à venir
Exécuter `Check`, puis `Apply` uniquement après succès. Recueillir le nouveau SHA UI et l'emplacement de sauvegarde, puis copier uniquement `ui.mjs` vers les assets Android sous contrôle SHA256, recompiler et installer sur l'AVD `A2S_Scola_SYNC12_Test` hors ligne. Valider ensuite le retour en un geste et l'ouverture du panneau sur la vraie WebView. Conserver UI-145 original, V2/main et Render inchangés ; identités fictives uniquement.
