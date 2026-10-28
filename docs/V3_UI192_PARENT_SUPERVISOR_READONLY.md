# UI-192 — Vues Parent / Superviseur, simples et sans refonte

Le nouveau module de présentation `mobile-session19/parent-supervisor-demo-dashboard.mjs` fournit des tableaux de bord structurés **en lecture seule** sur le même instantané Golf LUB-014 que les autres profils. Il applique les recommandations de manipulation UI-190/191.

**Parent :** suivi du circuit et de l'arrêt à venir, statut des élèves explicitement associés à la simulation, notifications filtrées par élève. Aucune localisation GPS réelle ni géolocalisation simulée comme si elle était fiable. La portée locale `pupilIds` n'est pas une autorisation parentale : la vraie affectation doit venir du serveur.

**Superviseur :** état de la tournée, élèves à bord, incidents ouverts et action prioritaire contextuelle. Vue consultative seulement ; la résolution métier reste dans le réducteur UI-188. Les incidents simulés n'autorisent pas des décisions opérationnelles réelles.

**Préservation stricte :** `mobile-session19/app.mjs` et `style.css` Accompagnateur, ainsi que `ui.mjs` Chauffeur, restent inchangés. Le portail Android UI-186 n'a pas encore été modifié et aucun nouvel APK n'a été construit. Les vues de ce module ne constituent pas de véritables écrans Android ; leur raccordement à la session Parent/Superviseur requiert une étape distincte.

Tests :
```
node --test test/v3-ui192-parent-supervisor-dashboard.test.mjs
```

Prochain objectif : raccorder ces vues à l'écran existant Parent/Superviseur dans une **copie indépendante** du projet Android UI-186, ne pas renommer ni écraser les applications déjà installées, puis vérifier les empreintes des fichiers Chauffeur/Accompagnateur avant et après compilation.
