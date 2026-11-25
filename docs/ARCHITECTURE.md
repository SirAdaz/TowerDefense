# Architecture

Site statique à plusieurs pages (Vite multi-page, TypeScript) : l'accueil à la racine, un dossier par jeu. Aucun serveur applicatif, aucune base, aucun appel réseau à l'exécution.

## Pages

| Adresse            | Page                       | Code                 |
| ------------------ | -------------------------- | -------------------- |
| `/`                | `index.html`               | `src/home/`          |
| `/tower-defense/`  | `tower-defense/index.html` | `src/tower-defense/` |
| `/nuit-blanche/`   | `nuit-blanche/index.html`  | `src/survival/`      |

- Les pages sont déclarées dans `vite.config.ts` (`PAGES`). `base: "/"` : le site est servi à la racine de son domaine, les assets (`/assets/…`) sont communs.
- L'accueil est du HTML statique : une carte par jeu. `src/home/records.ts` lit le record de chaque jeu dans le `localStorage`, à la clé où le jeu l'écrit, et l'affiche sur sa carte. Il n'importe que le strict nécessaire (`profile.ts`, `ui/format.ts`) : l'accueil ne charge pas le code des jeux.
- `src/shared/storage.ts` : l'interface `KeyValueStore` et son implémentation navigateur, communes à toutes les pages. `src/shared/dom.ts` : accès typé au gabarit HTML.
- Chaque jeu porte un lien « ← Jeux » vers l'accueil et garde ses propres clés `localStorage` (même origine : rien n'est perdu d'une page à l'autre).

Les deux jeux ont le même découpage (`game/` pur et testé, `render/` qui lit l'état, `ui/` qui relie le gabarit HTML). Cette page décrit d'abord le tower defense (`src/tower-defense/`), puis [Nuit blanche](#nuit-blanche-srcsurvival).

## Découpage

| Dossier       | Rôle                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game/`       | Logique pure, testée par Vitest avec seuils de couverture. Ni DOM, ni horloge, ni hasard ; le stockage passe par l'interface `KeyValueStore`.      |
| `render/`     | Dessin de la carte sur le `<canvas>` (style « plan technique ») à partir de l'état. Ne modifie jamais l'état.                                      |
| `ui/`         | Interface HTML : grille de boutons posée sur le canvas, bandeau, panneau, session (pause, vitesse, sauvegarde) et boucle de jeu.                   |
| `tests/`      | Joueur automatique (`bot.ts`) et règles d'équilibrage (`balance.test.ts`). `scripts/simulate.ts` affiche la courbe de difficulté (`npm run simulate`). |

### `src/tower-defense/game/`

| Fichier      | Contenu                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `balance.ts` | Tous les chiffres : coûts, jauges, ennemis, vagues, bonus. Source de vérité de `docs/product/SPECS.md`.       |
| `grid.ts`    | Carte 16 × 10, chemin fixe, conversions case ↔ point.                                                         |
| `types.ts`   | `GameState` (du JSON pur), `Tower`, `Enemy`, `GameEvent`.                                                     |
| `waves.ts`   | Composition d'une vague (sans hasard), intervalle d'entrée, vie des ennemis.                                  |
| `towers.ts`  | Poser, améliorer, vendre ; valeur des jauges ; coût et valeur de revente calculés depuis les niveaux.         |
| `engine.ts`  | `createGame`, `startNextWave`, `step` : entrées, déplacements, tirs, fin de vague, compte à rebours, défaite. |
| `save.ts`    | Sauvegarde de l'état complet, validation stricte à la lecture, record.                                        |

## Modèle : un état, des commandes, un pas

- `GameState` est un objet JSON sans référence ni fonction. Tout ce qui fait la partie y est : phase, vague, vies, argent, tourelles, ennemis et leur distance sur le chemin, minuteries.
- Les **commandes** du joueur (`buildTower`, `upgradeTower`, `sellTower`, `startNextWave`) et le **pas** (`step`) modifient l'état qu'on leur passe et rien d'autre. Même état + mêmes actions = même partie : c'est ce qui rend l'équilibrage testable et la reprise exacte.
- `step` avance la partie de 1/60 s et renvoie des **événements** (`shot`, `killed`, `leaked`, `waveStarted`, `waveCleared`, `gameOver`). La logique n'en dépend pas : ils servent au rendu (traits de tir, gains, vies perdues) et à l'interface (annonces, record, sauvegarde, écran de fin).
- Les tirs sont instantanés (pas de projectile dans l'état) : moins d'état, sauvegarde plus simple, aucun tir perdu.

## Boucle de jeu

- `requestAnimationFrame` mesure le temps écoulé, borné à 0,25 s par image (un onglet qui se réveille ne fait pas un bond).
- `advanceSession` convertit ce temps en **pas fixes** de 1/60 s. En ×2, le temps de jeu compte double : deux fois plus de pas, chacun identique. En pause ou après la défaite : aucun pas.
- Le rendu dessine l'état courant à chaque image, pause comprise.

## Interface

- Le canvas ne reçoit aucun événement. Par-dessus, une grille CSS de 160 emplacements : un `<button>` par case constructible, un emplacement vide par case du chemin. Souris et clavier passent par les mêmes boutons (clic, Entrée, flèches avec « tabindex » itinérant).
- Le gabarit est écrit dans `tower-defense/index.html` ; `ui/` ne fait que le relier à l'état. Les textes ne sont réécrits que s'ils changent.
- Aucun style en ligne : la CSP `style-src 'self'` de l'image nginx est respectée.

## Données locales

`localStorage`, deux clés :

- `towerdefense.snapshot.v1` : l'état complet de la partie et le réglage de vitesse. Écrit à chaque action, au début et à la fin de chaque vague, une fois par seconde en jeu, et à `visibilitychange` / `pagehide`. Validé champ par champ à la lecture, ignoré s'il est incohérent, effacé à la défaite.
- `towerdefense.best-wave.v1` : meilleure vague atteinte.

Toute erreur du stockage (navigation privée, quota) est absorbée : le jeu marche sans sauvegarde.

## Rendu

Canvas dimensionné sur sa taille affichée × `devicePixelRatio`. Le dessin se fait en unités de case (`setTransform`), les textes en pixels réels : la carte reste nette de 1024 à 1920 px. Les couleurs du canvas sont dans `src/tower-defense/render/theme.ts`, celles de l'interface dans `src/tower-defense/style.css`.

## Exécution

- Dev : `docker compose up -d --build` → Vite sur http://localhost:5180.
- Build de prod : image `prod` (nginx 1.30.4, en-têtes de sécurité, CSP `default-src 'self'`) → http://localhost:5181 avec `--profile prod`.
- nginx (`docker/nginx.conf`) : `/` sert l'accueil, chaque dossier de jeu retombe sur sa propre page, toute autre adresse donne une 404. Seul `dist/` est dans l'image : aucun fichier source n'est servi.

## Nuit blanche (`src/survival/`)

### `game/`

| Fichier          | Contenu                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `balance.ts`     | Tous les chiffres et les textes des cartes. Source de vérité de `docs/product/SPECS-NUIT-BLANCHE.md`.    |
| `types.ts`       | `GameState`, ennemis, projectiles, éclats, effets, cartes d'amélioration.                                |
| `state.ts`       | `createGame(seed, unlocked)` : crée les réserves une fois ; `takeFree` y prend une place.                |
| `rng.ts`         | Générateur à graine (mulberry32), son état vit dans la partie.                                           |
| `spatial.ts`     | Grille de voisinage : listes chaînées dans des tableaux fixes.                                           |
| `player.ts`      | Suivi du curseur à vitesse bornée, coups reçus, expérience, valeurs dérivées des passifs.                |
| `enemies.ts`     | Entrée d'un ennemi, poursuite, charge en trois temps, renforts du boss, écartement de la horde.          |
| `spawner.ts`     | Directeur des arrivées : rythme, composition par minute, élites, boss.                                   |
| `weapons.ts`     | Les cinq armes automatiques. `projectiles.ts` : déplacement et touchés. `combat.ts` : dégâts, éclats.    |
| `gems.ts`        | Attraction et ramassage des éclats.                                                                      |
| `upgrades.ts`    | Tirage des 3 cartes, application du choix.                                                               |
| `engine.ts`      | `step(state, input)`, fin de partie, score, pièces.                                                      |
| `profile.ts`     | Profil stocké (record, pièces, déblocages), validé à la lecture. `summary.ts` : bilan d'une partie finie. |

### Simulation

- `step` avance de 1/60 s vers le point visé par le joueur (`PlayerInput`). Il ne fait rien hors de la phase `playing` : un choix d'amélioration en attente (`levelUp`) fige tout, `won` et `lost` terminent la partie.
- **Aucune allocation par pas.** Ennemis (360), projectiles (200), éclats (300) et effets (64) vivent dans des réserves créées avec la partie ; `isActive` marque une place occupée. Une réserve pleine se gère sans erreur : l'ennemi n'entre pas, l'expérience d'un éclat rejoint un éclat existant, un effet visuel est omis.
- **Voisinage.** Chaque pas range les ennemis dans une grille (cases de 120 unités). L'écartement de la horde, les touchés des projectiles et les dégâts de zone ne regardent que les cases voisines, au lieu de comparer tous les ennemis deux à deux.
- **Déterminisme.** Le hasard (points d'entrée, composition, foudre, tirage des cartes) vient du générateur à graine de l'état. La graine d'une vraie partie est tirée par l'interface (`ui/app.ts`), jamais par `game/`.
- Les effets visuels (anneaux, impacts) sont dans l'état, sous forme de minuteries : le rendu n'a rien à mémoriser et la simulation n'émet pas d'événements.

### Interface et rendu

- Le canvas occupe la fenêtre entre deux bandes réservées au bandeau ; l'arène de 1600 × 900 y est mise à l'échelle et centrée. `Renderer.aimAt` fait la conversion inverse pour le curseur.
- Le rendu trace chaque type d'ennemi en un seul chemin et un seul remplissage : plusieurs centaines d'ennemis coûtent une poignée d'appels au canvas.
- Menus : le menu d'accueil du jeu (record, pièces, déblocages) et trois `<dialog>` modaux (choix d'amélioration, pause, score). Le focus y est enfermé par le navigateur ; Tab et Entrée suffisent.
- Boucle : `requestAnimationFrame`, temps borné à 0,25 s par image, converti en pas fixes. Pause, choix en attente ou menu : aucun pas.
- Données locales : une clé, `nuitblanche.profile.v1` (meilleur score, meilleur temps, victoire, pièces, déblocages). Pas de sauvegarde en cours de partie.
- `ui/devTools.ts` expose l'application sur `window.nuitBlancheTest` pour les tests en navigateur (lire l'état, accélérer le temps). Il n'est branché que si `import.meta.env.DEV` : le build de production ne le contient pas.
