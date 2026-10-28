# UI-187 — Phase 2 : état local commun avec contrôles de révision
Ajouts : `mobile-session19/golf-session-store.mjs` et `test/v3-ui187-golf-session-store.test.mjs`.

Le stockage accepte un adaptateur injecté compatible `getItem/setItem`; le test utilise un stockage mémoire. L'instantané contient le circuit Golf LUB-014. Les vues Chauffeur, Accompagnateur, Parent et Superviseur lisent les mêmes données. Les mises à jour exigent une révision attendue et une incrémentation de 1. Les fichiers corrompus et les révisions obsolètes sont refusés.

**Important :** `localStorage` n'offre pas d'écriture atomique entre onglets et ne prouve pas la signature de deux acteurs. Le module n'est pas directement raccordé aux interfaces existantes. Il ne gère pas encore les commandes métier ; l'ajout d'un réducteur validé par profil est requis. Les états existants Chauffeur et Accompagnateur n'ont pas été modifiés ni migrés.

## Tester dans le dépôt local
```powershell
node --test test/v3-ui187-golf-route-adapter.test.mjs test/v3-ui187-golf-session-store.test.mjs
```

## Prochaines conditions avant APK
1. Définir l'adaptateur des événements de conduite et de pointage avec validation de rôle et arrêt sécurisé.
2. Mettre en place une véritable coordination entre sessions si l'objectif est un partage entre profils distincts sur plusieurs téléphones.
3. Tests complets UI-178 et Chauffeur, captures comparatives, conservation de leurs fichiers visuels à empreintes identiques.
4. Ne jamais activer Opérationnel à partir de ce prototype.
