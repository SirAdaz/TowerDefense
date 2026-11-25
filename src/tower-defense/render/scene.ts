import { COLS, PATH, ROWS, cellCenter, type Point } from "../game/grid.ts";
import { FONT_FAMILY, THEME } from "./theme.ts";

/** Longueur des repères en croix dessinés aux intersections de la grille, en cases. */
const MARK_HALF_SIZE = 0.06;
const PATH_WIDTH = 0.72;
const PATH_EDGE = 0.045;

export interface LabelStyle {
  readonly color: string;
  /** Hauteur du texte en cases. */
  readonly size: number;
  readonly align: CanvasTextAlign;
}

/**
 * Écrit un texte à une position donnée en cases. Le texte est dessiné en pixels réels : une police
 * de 0,2 unité mise à l'échelle par la transformation du canvas serait arrondie par le navigateur.
 */
export function drawLabel(ctx: CanvasRenderingContext2D, text: string, at: Point, style: LabelStyle): void {
  const scale = ctx.getTransform().a;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${Math.round(style.size * scale)}px ${FONT_FAMILY}`;
  ctx.textAlign = style.align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = style.color;
  ctx.fillText(text, at.x * scale, at.y * scale);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = THEME.background;
  ctx.fillRect(0, 0, COLS, ROWS);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = THEME.gridLine;
  ctx.beginPath();
  for (let col = 1; col < COLS; col++) {
    ctx.moveTo(col, 0);
    ctx.lineTo(col, ROWS);
  }
  for (let row = 1; row < ROWS; row++) {
    ctx.moveTo(0, row);
    ctx.lineTo(COLS, row);
  }
  ctx.stroke();

  ctx.strokeStyle = THEME.gridMark;
  ctx.beginPath();
  for (let col = 1; col < COLS; col++) {
    for (let row = 1; row < ROWS; row++) {
      ctx.moveTo(col - MARK_HALF_SIZE, row);
      ctx.lineTo(col + MARK_HALF_SIZE, row);
      ctx.moveTo(col, row - MARK_HALF_SIZE);
      ctx.lineTo(col, row + MARK_HALF_SIZE);
    }
  }
  ctx.stroke();
}

/** Trace le chemin d'un bord à l'autre de la carte : il déborde d'une demi-case à l'entrée et à la sortie. */
function tracePath(ctx: CanvasRenderingContext2D): void {
  const first = cellCenter(PATH[0] ?? { col: 0, row: 0 });
  const last = cellCenter(PATH[PATH.length - 1] ?? { col: 0, row: 0 });
  ctx.beginPath();
  ctx.moveTo(first.x - 1, first.y);
  for (const cell of PATH) {
    const center = cellCenter(cell);
    ctx.lineTo(center.x, center.y);
  }
  ctx.lineTo(last.x + 1, last.y);
}

function drawPath(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  tracePath(ctx);
  ctx.strokeStyle = THEME.pathEdge;
  ctx.lineWidth = PATH_WIDTH + PATH_EDGE * 2;
  ctx.stroke();
  ctx.strokeStyle = THEME.pathFill;
  ctx.lineWidth = PATH_WIDTH;
  ctx.stroke();
  ctx.strokeStyle = THEME.pathDash;
  ctx.lineWidth = 0.035;
  ctx.setLineDash([0.16, 0.2]);
  ctx.stroke();
  ctx.setLineDash([]);

  const first = cellCenter(PATH[0] ?? { col: 0, row: 0 });
  const last = cellCenter(PATH[PATH.length - 1] ?? { col: 0, row: 0 });
  drawLabel(ctx, "ENTRÉE", { x: 0.12, y: first.y - 0.68 }, { color: THEME.label, size: 0.2, align: "left" });
  drawLabel(ctx, "SORTIE", { x: COLS - 0.12, y: last.y - 0.68 }, { color: THEME.label, size: 0.2, align: "right" });
}

/** Fond de carte : quadrillage du plan et chemin. */
export function drawScene(ctx: CanvasRenderingContext2D): void {
  drawGrid(ctx);
  drawPath(ctx);
}
