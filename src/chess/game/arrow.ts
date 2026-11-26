import { FILES } from "./notation.ts";
import type { PlayerColor } from "./types.ts";
import { parseUciMove } from "./uci.ts";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Côté d'une case dans le repère du dessin : l'échiquier mesure 8 × 100 unités. */
export const SQUARE_UNITS = 100;

/** Épaisseur du trait, largeur et longueur de la pointe, en unités du dessin. */
const SHAFT_HALF_WIDTH = 11;
const HEAD_HALF_WIDTH = 28;
const HEAD_LENGTH = 40;

const BOARD_SIZE = 8;

/** Centre d'une case vue d'un camp (le camp du joueur en bas) ; `null` pour une case inconnue. */
export function squareCenter(square: string, orientation: PlayerColor): Point | null {
  const fileIndex = FILES.indexOf(square.charAt(0));
  const rank = Number(square.slice(1));
  if (square.length !== 2 || fileIndex === -1 || !Number.isInteger(rank) || rank < 1 || rank > BOARD_SIZE) {
    return null;
  }
  const column = orientation === "white" ? fileIndex : BOARD_SIZE - 1 - fileIndex;
  const row = orientation === "white" ? BOARD_SIZE - rank : rank - 1;
  return { x: (column + 0.5) * SQUARE_UNITS, y: (row + 0.5) * SQUARE_UNITS };
}

function roundPoint(x: number, y: number): Point {
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/**
 * Contour d'une flèche (7 points) du centre de la case de départ au centre de l'arrivée : un trait
 * puis une pointe. Une forme pleine se lit sans la couleur ; `null` si le coup est mal formé.
 */
export function arrowPoints(uci: string, orientation: PlayerColor): Point[] | null {
  const move = parseUciMove(uci);
  const start = move === null ? null : squareCenter(move.from, orientation);
  const tip = move === null ? null : squareCenter(move.to, orientation);
  if (start === null || tip === null || (start.x === tip.x && start.y === tip.y)) {
    return null;
  }
  const length = Math.hypot(tip.x - start.x, tip.y - start.y);
  const unitX = (tip.x - start.x) / length;
  const unitY = (tip.y - start.y) / length;
  const baseX = tip.x - unitX * HEAD_LENGTH;
  const baseY = tip.y - unitY * HEAD_LENGTH;
  const side = (x: number, y: number, halfWidth: number) => roundPoint(x - unitY * halfWidth, y + unitX * halfWidth);
  return [
    side(start.x, start.y, SHAFT_HALF_WIDTH),
    side(baseX, baseY, SHAFT_HALF_WIDTH),
    side(baseX, baseY, HEAD_HALF_WIDTH),
    roundPoint(tip.x, tip.y),
    side(baseX, baseY, -HEAD_HALF_WIDTH),
    side(baseX, baseY, -SHAFT_HALF_WIDTH),
    side(start.x, start.y, -SHAFT_HALF_WIDTH),
  ];
}
