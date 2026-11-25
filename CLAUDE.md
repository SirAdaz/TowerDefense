@AGENTS.md

# TowerDefense

Petits jeux solo dans le navigateur, joués à la souris sur ordinateur : une page d'accueil (`/`) et un dossier par jeu (`/tower-defense/`, `/nuit-blanche/` dont le code est dans `src/survival/`). Vite 8 multi-page + TypeScript 6 strict + Canvas 2D, site statique (`docs/DECISIONS.md`). Node 24 dans Docker uniquement.

## Commandes

- `docker compose exec app npm run ci` : lint + typecheck + tests (seuils de couverture sur `src/*/game/`) + build. À passer avant tout push.
- `docker compose up -d --build` : Vite sur http://localhost:5180. Build de prod nginx : `--profile prod` → http://localhost:5181.

## Qualité

- Règles appliquées par `eslint.quality.mjs`, en erreur : fonction <= 80 lignes, complexité <= 10, imbrication <= 3, <= 4 paramètres, fichier <= 300 lignes, noms explicites, booléens `is/has/can…`, pas de `any`, de TODO, de catch vide ni de `console.log`.
- Aucune règle désactivée pour passer. Exception rare : `// eslint-disable-next-line <règle> -- <raison>`.
- Logique de chaque jeu dans `src/<jeu>/game/` (fonctions pures, JSDoc du pourquoi), couverture ≥ 90 % lignes ; un correctif vient avec son test.

## Process

- Branche depuis `origin/main` (`feat/ fix/ chore/ …`), commits conventionnels courts en anglais, PR → CI GitHub (`ubuntu-latest`) → merge.
- Dépôt public : aucun secret, aucune donnée personnelle, aucun chemin local dans le code, les docs, les commits ni les PR.

## Pièges

- Nouveau jeu = une page `<dossier>/index.html`, son entrée dans `vite.config.ts` (`PAGES`), son bloc `location` dans `docker/nginx.conf`, sa carte dans `index.html` et son record dans `src/home/records.ts`.
- Échecs (`/echecs/`, `src/chess/`) : `game/` pur et testé, `data/` pour le réseau, IndexedDB et le moteur, `ui/` pour le plateau. Stockfish est sous GPL-3.0 : ses fichiers restent séparés (import `?url`, Web Worker) et toute montée de version met à jour `THIRD-PARTY-NOTICES.md` et `public/licences/echecs.txt`. Aucun pseudo réel dans le code, les tests ou les docs.
- Nuit blanche : la simulation (`src/survival/game/`) ne crée aucun objet par pas (réserves de taille fixe, grille de voisinage) ; garder cette règle dans `step` et tout ce qu'il appelle.
- `window.nuitBlancheTest` (vitesse du temps, état) n'existe que sur le serveur Vite (`import.meta.env.DEV`) : jamais dans le build.
- La CSP de `docker/security-headers.conf` est recopiée par le serveur de production : ne pas la changer sans le signaler.
- Les imports internes portent l'extension `.ts` (`allowImportingTsExtensions`) : un script TypeScript tourne directement avec Node 24.
- `assetsInlineLimit: 0` : la police doit rester un fichier, la CSP de l'image nginx refuse les polices en `data:`.
