/** Position d'une case de la grille (colonne, ligne), origine en haut à gauche. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** Point en coordonnées de grille : 1 unité = 1 case, (0.5, 0.5) = centre de la première case. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const COLS = 16;
export const ROWS = 10;

/**
 * Chemin fixe de la carte, case par case, de l'entrée (gauche) à la sortie (droite).
 * Repris de la maquette « Pixel douillet » : 36 cases, 35 segments.
 */
const PATH_STEPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [5, 4], [4, 4], [3, 4], [2, 4],
  [2, 5], [2, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [8, 6], [8, 5], [8, 4],
  [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [12, 4], [12, 5], [12, 6], [12, 7], [13, 7], [14, 7], [15, 7],
];

export const PATH: readonly Cell[] = PATH_STEPS.map(([col, row]) => ({ col, row }));

/** Longueur du chemin en cases, du centre de la première au centre de la dernière : un ennemi qui l'atteint sort. */
export const PATH_LENGTH = PATH.length - 1;

/** Clé texte d'une case, pour les ensembles et les recherches. */
export function cellKey(cell: Cell): string {
  return `${cell.col},${cell.row}`;
}

const PATH_KEYS = new Set(PATH.map(cellKey));

/** Vrai si la case est dans les limites de la carte. */
export function isInsideGrid(cell: Cell): boolean {
  return cell.col >= 0 && cell.col < COLS && cell.row >= 0 && cell.row < ROWS;
}

/** Vrai si la case fait partie du chemin : on n'y construit jamais. */
export function isOnPath(cell: Cell): boolean {
  return PATH_KEYS.has(cellKey(cell));
}

/** Centre d'une case en coordonnées de grille. */
export function cellCenter(cell: Cell): Point {
  return { x: cell.col + 0.5, y: cell.row + 0.5 };
}

/**
 * Point du chemin à `distance` cases de l'entrée. Borné aux deux extrémités : avant 0, l'entrée ;
 * au-delà de PATH_LENGTH, la sortie. Les segments font tous une case, d'où l'indexation directe.
 */
export function pointAlongPath(distance: number): Point {
  const clamped = Math.min(Math.max(distance, 0), PATH_LENGTH);
  const index = Math.min(Math.floor(clamped), PATH_LENGTH - 1);
  const from = cellCenter(pathCell(index));
  const to = cellCenter(pathCell(index + 1));
  const fraction = clamped - index;
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

/** Case n° `index` du chemin (bornée au chemin). */
export function pathCell(index: number): Cell {
  const bounded = Math.min(Math.max(index, 0), PATH_LENGTH);
  return PATH[bounded] ?? { col: 0, row: 0 };
}

/** Case qui contient un point de la grille (ex. position de la souris convertie en unités de case). */
export function cellAt(point: Point): Cell {
  return { col: Math.floor(point.x), row: Math.floor(point.y) };
}
