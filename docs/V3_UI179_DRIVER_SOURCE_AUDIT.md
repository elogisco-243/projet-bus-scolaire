# UI-179 — identification de la véritable interface Chauffeur
Le dépôt actuel inclut `frontend/src/app.mjs` avec un rôle Chauffeur générique (navigation « Ma tournée / Prise en charge / Signaler un incident »), et `android-sync07/testhost/src/main/assets/public/index.html` contenant un banc de test « Native Bridge TEST ». Ces deux ressources ne prouvent pas la présence du modèle Chauffeur mobile complet approuvé avec quatre actions « Démarrer la course, Nouvelle tournée, Arrêt atteint, Clôturer la course » et navigation validée.

L'interface complète Accompagnateur est bien dans `mobile-session19/app.mjs`, validée visuellement. **Ne pas écraser la véritable interface Chauffeur par l'écran générique ou le banc de test.**

La branche UI-179 ne modifie ni visuel ni code d'exécution. Elle ajoute une recette de provenance pour éviter de raccorder le mauvais Chauffeur. Sur le PC Windows, rechercher l'APK/source Chauffeur réellement approuvé et identifier son point d'entrée ; sauvegarder et comparer les empreintes avant intégration.

UI-179 : audit de source, **pas** raccordement terminé. Mode Opérationnel désactivé.
