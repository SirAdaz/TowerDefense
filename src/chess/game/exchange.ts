import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import { valueOf } from "./tactics.ts";

/** Valeur d'une pièce qui vient de jouer : une promotion vaut la pièce obtenue. */
function movedValue(move: Move): number {
  return valueOf(move.promotion ?? move.piece);
}

/** Prise la moins chère sur une case : on reprend toujours avec la pièce de plus faible valeur. */
function cheapestCaptureOn(chess: Chess, square: Square): Move | undefined {
  const captures = chess.moves({ verbose: true }).filter((move) => move.to === square && move.captured !== undefined);
  return captures.sort((left, right) => movedValue(left) - movedValue(right))[0];
}

/**
 * Bilan d'un échange (« static exchange evaluation ») : ce que gagne en pions le camp qui joue
 * `move` si chacun reprend sur la case avec sa pièce la moins chère, et peut s'arrêter quand
 * continuer lui coûterait. Seuls les coups légaux comptent : une pièce clouée ne reprend pas.
 * C'est ce qui dit qu'une pièce est « mal défendue » : la prendre gagne même si elle est défendue.
 */
export function exchangeGain(chess: Chess, move: Move): number {
  const board = new Chess(chess.fen());
  const gains: number[] = [move.captured === undefined ? 0 : valueOf(move.captured)];
  board.move(move);
  let lastValue = movedValue(move);
  for (let recapture = cheapestCaptureOn(board, move.to); recapture !== undefined; recapture = cheapestCaptureOn(board, move.to)) {
    gains.push(lastValue - (gains.at(-1) ?? 0));
    lastValue = movedValue(recapture);
    board.move(recapture);
  }
  for (let index = gains.length - 1; index > 0; index -= 1) {
    gains[index - 1] = -Math.max(-(gains[index - 1] ?? 0), gains[index] ?? 0);
  }
  return gains[0] ?? 0;
}

/** Prise qui gagne le plus au camp au trait, avec son bilan ; `null` sans prise qui gagne du matériel. */
export interface BestCapture {
  readonly move: Move;
  readonly gain: number;
}

export function bestCapture(chess: Chess, gainOf: (move: Move) => number = (move) => exchangeGain(chess, move)): BestCapture | null {
  let best: BestCapture | null = null;
  for (const move of chess.moves({ verbose: true })) {
    if (move.captured === undefined) {
      continue;
    }
    const gain = gainOf(move);
    if (gain > 0 && (best === null || gain > best.gain)) {
      best = { move, gain };
    }
  }
  return best;
}
