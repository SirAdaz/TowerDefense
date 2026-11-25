import { ARENA_HEIGHT, ARENA_WIDTH } from "./balance.ts";
import type { GameState } from "./types.ts";

/** Côté d'une case : plus grand que le plus gros ennemi, pour qu'un voisin soit dans une case adjacente. */
const CELL_SIZE = 120;
const GRID_COLS = Math.ceil(ARENA_WIDTH / CELL_SIZE);
const GRID_ROWS = Math.ceil(ARENA_HEIGHT / CELL_SIZE);
export const GRID_CELL_COUNT = GRID_COLS * GRID_ROWS;
/** Marge ajoutée aux recherches : le rayon du plus gros ennemi (un élite ou le boss). */
const LARGEST_ENEMY_RADIUS = 60;

function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}

/** Les ennemis hors de l'arène (ils y entrent par les bords) sont rangés dans la case du bord. */
function columnOf(x: number): number {
  return clampIndex(Math.floor(x / CELL_SIZE), GRID_COLS);
}

function rowOf(y: number): number {
  return clampIndex(Math.floor(y / CELL_SIZE), GRID_ROWS);
}

/**
 * Range chaque ennemi vivant dans sa case. À refaire après les déplacements : les collisions ne
 * comparent ensuite que des voisins, au lieu de tous les ennemis deux à deux.
 */
export function rebuildGrid(state: GameState): void {
  const { heads, next } = state.grid;
  heads.fill(-1);
  for (let index = 0; index < state.enemies.length; index++) {
    const enemy = state.enemies[index];
    if (enemy === undefined || !enemy.isActive) {
      continue;
    }
    const cell = rowOf(enemy.y) * GRID_COLS + columnOf(enemy.x);
    next[index] = heads[cell] ?? -1;
    heads[cell] = index;
  }
}

/**
 * Écrit dans `state.grid.nearby` les indices des ennemis des cases qui touchent le disque donné,
 * et renvoie leur nombre. Sur-ensemble : l'appelant fait le test de distance exact.
 */
export function findEnemiesNear(state: GameState, x: number, y: number, radius: number): number {
  const { heads, next, nearby } = state.grid;
  const reach = radius + LARGEST_ENEMY_RADIUS;
  const lastCol = columnOf(x + reach);
  const lastRow = rowOf(y + reach);
  let found = 0;
  for (let row = rowOf(y - reach); row <= lastRow; row++) {
    for (let col = columnOf(x - reach); col <= lastCol; col++) {
      let index = heads[row * GRID_COLS + col] ?? -1;
      while (index >= 0) {
        nearby[found++] = index;
        index = next[index] ?? -1;
      }
    }
  }
  return found;
}
