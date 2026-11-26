import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { parseUciMove } from "./uci.ts";

/**
 * Avis sur un coup, des deux camps, comme dans une revue de partie. Les seuils portent sur les
 * chances de gain perdues par le camp qui joue (0 à 100, formule de Lichess) : perdre 10 points à
 * égalité compte, perdre 10 points quand la partie est gagnée de toute façon compte beaucoup moins.
 */
export type MoveClass = "brilliant" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "miss" | "blunder";

/** Ordre d'affichage du résumé : du meilleur au pire. */
export const MOVE_CLASS_ORDER: readonly MoveClass[] = [
  "brilliant",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

/** Chances de gain perdues (points) en dessous desquelles un coup reste excellent, bon, imprécis, une erreur. */
export const EXCELLENT_MAX_LOSS = 2;
export const GOOD_MAX_LOSS = 5;
export const INACCURACY_MAX_LOSS = 10;
export const MISTAKE_MAX_LOSS = 20;

/** Occasion manquée : l'adversaire venait de perdre au moins 10 points, et le coup en rend au moins autant. */
export const MISS_OPPONENT_LOSS = 10;
/** … sans tomber sous 35 % de chances : sinon c'est une erreur ou une gaffe tout court. */
export const MISS_MIN_WIN_AFTER = 35;

/** Brillant : sacrifice du meilleur coup, dans une partie encore à jouer, qui laisse au moins l'égalité. */
export const BRILLIANT_MAX_WIN_BEFORE = 90;
export const BRILLIANT_MIN_WIN_AFTER = 50;
/** Sacrifice : la pièce jouée peut être prise en perdant au moins deux pions de matériel. */
export const SACRIFICE_MIN_MATERIAL = 2;

const PIECE_VALUES: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export interface MoveFacts {
  /** Chances de gain perdues par le camp qui joue (0 ou plus). */
  readonly loss: number;
  /** Le coup est celui que le moteur jouait. */
  readonly isBest: boolean;
  readonly isSacrifice: boolean;
  /** Chances de gain perdues par l'adversaire à son coup précédent. */
  readonly opponentLoss: number;
  readonly winBefore: number;
  readonly winAfter: number;
}

function isBrilliant(facts: MoveFacts): boolean {
  return (
    facts.isSacrifice &&
    facts.loss < EXCELLENT_MAX_LOSS &&
    facts.winBefore <= BRILLIANT_MAX_WIN_BEFORE &&
    facts.winAfter >= BRILLIANT_MIN_WIN_AFTER
  );
}

function isMiss(facts: MoveFacts): boolean {
  return facts.opponentLoss >= MISS_OPPONENT_LOSS && facts.loss >= INACCURACY_MAX_LOSS && facts.winAfter >= MISS_MIN_WIN_AFTER;
}

function classByLoss(loss: number): MoveClass {
  if (loss < EXCELLENT_MAX_LOSS) {
    return "excellent";
  }
  if (loss < GOOD_MAX_LOSS) {
    return "good";
  }
  if (loss < INACCURACY_MAX_LOSS) {
    return "inaccuracy";
  }
  return loss < MISTAKE_MAX_LOSS ? "mistake" : "blunder";
}

/** Avis sur un coup. Brillant et occasion manquée passent avant le classement par la perte. */
export function classifyFacts(facts: MoveFacts): MoveClass {
  if (isBrilliant(facts)) {
    return "brilliant";
  }
  if (isMiss(facts)) {
    return "miss";
  }
  if (facts.isBest) {
    return "best";
  }
  return classByLoss(facts.loss);
}

function lowestValue(chess: Chess, squares: readonly Square[]): number {
  return Math.min(...squares.map((square) => PIECE_VALUES[chess.get(square)?.type ?? "k"] ?? 100));
}

/**
 * Le coup laisse-t-il une pièce (ni pion ni roi) en prise contre moins qu'elle ne vaut ? Elle est
 * attaquée et soit non défendue, soit attaquée par une pièce de moindre valeur. Règle prudente :
 * un échange égal n'en est pas un, et le roi ne prend pas une pièce défendue.
 */
/** Après le coup : la pièce arrivée en `target` peut-elle être prise avec profit ? */
function canBeWon(chess: Chess, target: Square, pieceValue: number): boolean {
  const owner = chess.get(target)?.color ?? "w";
  const defenders = chess.attackers(target, owner);
  const isDefended = defenders.length > 0;
  const attackers = chess.attackers(target, owner === "w" ? "b" : "w").filter((square) => !isDefended || chess.get(square)?.type !== "k");
  return attackers.length > 0 && (!isDefended || lowestValue(chess, attackers) < pieceValue);
}

/** Valeur de la pièce posée sur une case (0 si elle est vide). */
function valueAt(chess: Chess, square: string): number {
  return PIECE_VALUES[chess.get(square as Square)?.type ?? ""] ?? 0;
}

function tryPlay(chess: Chess, move: { from: string; to: string; promotion?: string }): boolean {
  try {
    chess.move(move);
    return true;
  } catch {
    return false;
  }
}

export function isSacrifice(fenBefore: string, uci: string): boolean {
  const move = parseUciMove(uci);
  const chess = new Chess(fenBefore);
  if (move === null || !["n", "b", "r", "q"].includes(chess.get(move.from as Square)?.type ?? "")) {
    return false;
  }
  const pieceValue = valueAt(chess, move.from);
  if (pieceValue - valueAt(chess, move.to) < SACRIFICE_MIN_MATERIAL || !tryPlay(chess, move)) {
    return false;
  }
  return canBeWon(chess, move.to as Square, pieceValue);
}
