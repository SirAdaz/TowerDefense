# Règles tous outils

- Langue du code : anglais ; textes affichés au joueur et docs : français.
- Site statique Vite + TypeScript strict + Canvas 2D. Pas de framework, pas de serveur, pas de base : ne pas en ajouter sans décision notée dans `docs/DECISIONS.md`.
- `src/<jeu>/game/` reste pur (ni DOM, ni `Date`, ni `Math.random`, ni `localStorage` direct : le stockage passe par l'interface `KeyValueStore`). Le rendu (`src/<jeu>/render/`) lit l'état sans le modifier.
- Aucun appel réseau à l'exécution (le jeu doit marcher hors ligne) : polices et ressources hébergées avec le projet.
- Toute règle de jeu ou tout chiffre d'équilibrage change dans le `balance.ts` du jeu ET sa page de specs (`docs/product/`), avec son test.
- Chaque jeu a son identité visuelle et ses clés `localStorage` préfixées ; l'accueil reste neutre. Aucun style en ligne (CSP `style-src 'self'`).
- Ne jamais lire ni committer de `.env`.
- Ne pas contourner un hook ou une règle de lint ; corriger la cause.
