import { Chess } from "chess.js";
import { toPlayerView, winPercent } from "./evaluation.ts";
import type { EngineScore, PlayerColor } from "./types.ts";
import { parseUciMove } from "./uci.ts";

/**
 * Une suite de coups qu'on parcourt après un problème : la position de départ, les coups (UCI) et
 * combien sont joués. Jouer un coup ailleurs qu'au bout coupe la suite : on explore une autre branche.
 */
export interface ExploreLine {
  readonly startFen: string;
  readonly moves: readonly string[];
  readonly index: number;
}

export interface EvaluationText {
  /** Phrase lue par les lecteurs d'écran et affichée sous le plateau. */
  readonly text: string;
  /** Chances de gain du joueur (0 à 100), pour la barre. */
  readonly winPercent: number;
}

function clampIndex(index: number, moveCount: number): number {
  return Math.max(0, Math.min(moveCount, Math.trunc(index)));
}

export function createLine(startFen: string, moves: readonly string[] = [], index = 0): ExploreLine {
  return { startFen, moves, index: clampIndex(index, moves.length) };
}

/** Joue un coup UCI sur `chess` ; faux s'il est mal formé ou illégal (la position ne change pas). */
function tryMove(chess: Chess, uci: string): boolean {
  const move = parseUciMove(uci);
  if (move === null) {
    return false;
  }
  try {
    chess.move(move);
    return true;
  } catch {
    return false;
  }
}

/** Suite en notation (`Dxf7+`, `Rxf7`) traduite en coups UCI ; s'arrête au premier coup illisible. */
export function sanLineToUci(fen: string, sanMoves: readonly string[]): string[] {
  const chess = new Chess(fen);
  const moves: string[] = [];
  for (const san of sanMoves) {
    try {
      const move = chess.move(san);
      moves.push(`${move.from}${move.to}${move.promotion ?? ""}`);
    } catch {
      break;
    }
  }
  return moves;
}

export function goTo(line: ExploreLine, index: number): ExploreLine {
  return { ...line, index: clampIndex(index, line.moves.length) };
}

/** Position après les coups joués de la suite. */
export function fenAt(line: ExploreLine): string {
  const chess = new Chess(line.startFen);
  for (const uci of line.moves.slice(0, line.index)) {
    if (!tryMove(chess, uci)) {
      break;
    }
  }
  return chess.fen();
}

/** Joue un coup à l'endroit où l'on est : la suite au-delà est oubliée. `null` si le coup est illégal. */
export function playMove(line: ExploreLine, uci: string): ExploreLine | null {
  if (!tryMove(new Chess(fenAt(line)), uci)) {
    return null;
  }
  return { startFen: line.startFen, moves: [...line.moves.slice(0, line.index), uci], index: line.index + 1 };
}

/** Dernier coup joué (surligné), ou `null` au départ. */
export function lastMoveOf(line: ExploreLine): string | null {
  return line.moves[line.index - 1] ?? null;
}

/** Coup suivant de la suite (dessiné en flèche), ou `null` au bout. */
export function upcomingMove(line: ExploreLine): string | null {
  return line.moves[line.index] ?? null;
}

export function sideToMove(fen: string): PlayerColor {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

function formatPawns(cp: number): string {
  const pawns = Math.abs(cp) / 100;
  return pawns.toFixed(1).replace(".", ",");
}

/** « +3,0 », « −1,2 » : une évaluation en pions, avec son signe. */
export function formatPawnsSigned(cp: number): string {
  return `${cp >= 0 ? "+" : "−"}${formatPawns(cp)}`;
}

/**
 * Évaluation du moteur dite du côté du joueur, quel que soit le camp au trait : « +1,3, avantage pour
 * vous », « mat en 2 pour l'adversaire ». À moins de 0,3 pion, la position est dite égale.
 */
export function describeEvaluation(score: EngineScore, isPlayerToMove: boolean): EvaluationText {
  const view = toPlayerView(score, isPlayerToMove);
  const percent = Math.round(winPercent(view.cp));
  if (view.mate !== "none" && view.mateMoves === 0) {
    return { text: "Échec et mat.", winPercent: percent };
  }
  if (view.mate !== "none") {
    const who = view.mate === "winning" ? "pour vous" : "pour l'adversaire";
    return { text: `Évaluation : mat en ${view.mateMoves} ${who}.`, winPercent: percent };
  }
  if (Math.abs(view.cp) < 30) {
    return { text: "Évaluation : position égale.", winPercent: percent };
  }
  const sign = view.cp > 0 ? "+" : "−";
  const who = view.cp > 0 ? "avantage pour vous" : "avantage pour l'adversaire";
  return { text: `Évaluation : ${sign}${formatPawns(view.cp)}, ${who}.`, winPercent: percent };
}
