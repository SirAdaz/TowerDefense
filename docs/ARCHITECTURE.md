# Architecture

Site statique : `index.html` + un bundle Vite (TypeScript) + la police. Aucun serveur applicatif, aucune base, aucun appel réseau à l'exécution.

## Découpage

| Dossier       | Rôle                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/`   | Logique pure, testée par Vitest avec seuils de couverture. Ni DOM, ni horloge, ni hasard ; le stockage passe par l'interface `KeyValueStore`.      |
| `src/render/` | Dessin de la carte sur le `<canvas>` (style « plan technique ») à partir de l'état. Ne modifie jamais l'état.                                      |
| `src/ui/`     | Interface HTML : grille de boutons posée sur le canvas, bandeau, panneau, session (pause, vitesse, sauvegarde) et boucle de jeu.                   |
| `tests/`      | Joueur automatique (`bot.ts`) et règles d'équilibrage (`balance.test.ts`). `scripts/simulate.ts` affiche la courbe de difficulté (`npm run simulate`). |

### `src/game/`

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
- Le gabarit est écrit dans `index.html` ; `src/ui/` ne fait que le relier à l'état. Les textes ne sont réécrits que s'ils changent.
- Aucun style en ligne : la CSP `style-src 'self'` de l'image nginx est respectée.

## Données locales

`localStorage`, deux clés :

- `towerdefense.snapshot.v1` : l'état complet de la partie et le réglage de vitesse. Écrit à chaque action, au début et à la fin de chaque vague, une fois par seconde en jeu, et à `visibilitychange` / `pagehide`. Validé champ par champ à la lecture, ignoré s'il est incohérent, effacé à la défaite.
- `towerdefense.best-wave.v1` : meilleure vague atteinte.

Toute erreur du stockage (navigation privée, quota) est absorbée : le jeu marche sans sauvegarde.

## Rendu

Canvas dimensionné sur sa taille affichée × `devicePixelRatio`. Le dessin se fait en unités de case (`setTransform`), les textes en pixels réels : la carte reste nette de 1024 à 1920 px. Les couleurs du canvas sont dans `src/render/theme.ts`, celles de l'interface dans `src/style.css`.

## Exécution

- Dev : `docker compose up -d --build` → Vite sur http://localhost:5180.
- Build de prod : image `prod` (nginx 1.30.4, en-têtes de sécurité, CSP `default-src 'self'`) → http://localhost:5181 avec `--profile prod`.
