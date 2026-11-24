# Règles tous outils

- Langue du code : anglais ; textes affichés au joueur et docs : français.
- Site statique Vite + TypeScript strict + Canvas 2D. Pas de framework, pas de serveur, pas de base : ne pas en ajouter sans décision notée dans `docs/DECISIONS.md`.
- `src/game/` reste pur (ni DOM, ni `Date`, ni `Math.random`, ni `localStorage` direct : le stockage passe par l'interface `KeyValueStore`). Le rendu (`src/render/`) lit l'état sans le modifier.
- Aucun appel réseau à l'exécution (le jeu doit marcher hors ligne) : polices et ressources hébergées avec le projet.
- Toute règle de jeu ou tout chiffre d'équilibrage change dans `src/game/balance.ts` ET `docs/product/SPECS.md`, avec son test.
- Ne jamais lire ni committer de `.env`.
- Ne pas contourner un hook ou une règle de lint ; corriger la cause.
