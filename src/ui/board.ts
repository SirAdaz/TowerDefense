import { COLS, type Cell, ROWS } from "../game/grid.ts";
import { CELL_PX } from "../render/palette.ts";
import { type SceneView, drawScene } from "../render/scene.ts";

/**
 * Garde la résolution interne du canvas égale à sa taille affichée × devicePixelRatio, pour une
 * carte nette de 1024 à 1920 px. Rappelle `onResize` (redessin) à chaque changement.
 */
export function watchCanvasSize(canvas: HTMLCanvasElement, onResize: () => void): void {
  const resize = (): void => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round((width * ROWS) / COLS));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    onResize();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
}

/** Dessine la scène à l'échelle du canvas (repère de dessin : 1 case = 56 unités). */
export function drawBoard(canvas: HTMLCanvasElement, view: SceneView): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const scale = canvas.width / (COLS * CELL_PX);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawScene(ctx, view);
}

/** Case sous le pointeur, ou null hors de la carte. */
export function cellFromPointer(canvas: HTMLCanvasElement, event: MouseEvent): Cell | null {
  const bounds = canvas.getBoundingClientRect();
  const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * COLS);
  const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * ROWS);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

const ARROW_MOVES: Record<string, Cell> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
};

/** Case suivante pour une flèche du clavier (bornée à la carte), ou null si la touche n'est pas une flèche. */
export function moveCursor(cursor: Cell | null, key: string): Cell | null {
  const move = ARROW_MOVES[key];
  if (!move) return null;
  const from = cursor ?? { col: 0, row: 0 };
  return {
    col: Math.min(Math.max(from.col + move.col, 0), COLS - 1),
    row: Math.min(Math.max(from.row + move.row, 0), ROWS - 1),
  };
}
