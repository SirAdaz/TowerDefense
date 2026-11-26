import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import { classifyMove } from "./evaluation.ts";
import { frenchSan } from "./notation.ts";
import type { DrillThreat } from "./types.ts";
import { parseUciMove } from "./uci.ts";

/** Valeur des pièces en pions, pour dire si une prise gagne du matériel. */
export const PIECE_VALUES: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Menace adverse concrète : une prise qui gagne du matériel (pièce non défendue, ou qui vaut plus
 * que celle qui prend), ou un mat au coup suivant.
 */
export type Threat = DrillThreat;

/**
 * Même position, l'adversaire au trait : ce qu'il ferait si le joueur « passait » son tour.
 * `null` si le joueur est en échec (passer serait illégal) ou si la position obtenue est invalide.
 */
export function passTurn(fen: string): string | null {
  const chess = new Chess(fen);
  if (chess.inCheck()) {
    return null;
  }
  const fields = fen.split(" ");
  const flipped = [fields[0], fields[1] === "w" ? "b" : "w", fields[2] ?? "-", "-", fields[4] ?? "0", fields[5] ?? "1"].join(" ");
  try {
    return new Chess(flipped).fen();
  } catch {
    return null;
  }
}

function tryMove(chess: Chess, uci: string): Move | null {
  const parsed = parseUciMove(uci);
  if (parsed === null) {
    return null;
  }
  try {
    return chess.move(parsed);
  } catch {
    return null;
  }
}

/** Vrai si, après la prise, le camp au trait peut reprendre sur la case. */
function canRecapture(chess: Chess, square: string): boolean {
  return chess.moves({ verbose: true }).some((move) => move.to === (square as Square));
}

/** Une prise gagne du matériel si la pièce prise n'est pas défendue, ou vaut plus que celle qui prend. */
function isWinningCapture(chess: Chess, move: Move): boolean {
  if (move.captured === undefined) {
    return false;
  }
  const capturedValue = PIECE_VALUES[move.captured] ?? 0;
  const capturerValue = PIECE_VALUES[move.piece] ?? 0;
  return capturedValue > capturerValue || !canRecapture(chess, move.to);
}

/**
 * Menace que le joueur a laissée passer : le coup qui l'a puni (meilleur coup du moteur après la
 * gaffe) était-il déjà possible avant, et concret (mat, ou prise gagnante) ? Une menace créée par
 * la gaffe elle-même (pièce déplacée en prise) n'en est pas une : `null`.
 */
export function detectThreat(fenBefore: string, punishUci: string): Threat | null {
  const passed = passTurn(fenBefore);
  if (passed === null) {
    return null;
  }
  const chess = new Chess(passed);
  const move = tryMove(chess, punishUci);
  if (move === null) {
    return null;
  }
  const isMate = chess.isCheckmate();
  if (!isMate && !isWinningCapture(chess, move)) {
    return null;
  }
  return { kind: isMate ? "mate" : "capture", moveUci: punishUci, from: move.from, to: move.to, san: move.san };
}

/** La case désignée répond-elle à « que menace l'adversaire ? » : la pièce qui menace ou sa cible. */
export function isThreatSquare(threat: Threat, square: string): boolean {
  return square === threat.from || square === threat.to;
}

/**
 * Une parade est bonne si elle garde l'évaluation : ni erreur ni gaffe selon le barème du bilan
 * (perte de moins d'un pion, ou de peu de chances de gain). Pas besoin du meilleur coup.
 */
export function isGoodParry(cpBefore: number, cpAfter: number): boolean {
  const quality = classifyMove(cpBefore, cpAfter);
  return quality === "good" || quality === "inaccuracy";
}

/** Nom d'une pièce avec son article, pour les phrases d'explication. */
const PIECE_PHRASES: Readonly<Record<string, string>> = {
  p: "le pion",
  n: "le cavalier",
  b: "le fou",
  r: "la tour",
  q: "la dame",
  k: "le roi",
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * La menace dite en clair : « Le pion en e5 peut prendre votre cavalier en f6 (exf6). », « La dame
 * en h5 menace de mater en f7 (Dxf7#). ». `fen` : la position où le joueur a le trait.
 */
export function describeThreat(fen: string, threat: Threat): string {
  const board = new Chess(fen);
  const attacker = PIECE_PHRASES[board.get(threat.from as Square)?.type ?? ""] ?? "la pièce";
  const san = frenchSan(threat.san);
  if (threat.kind === "mate") {
    return `${capitalize(attacker)} en ${threat.from} menace de mater en ${threat.to} (${san}).`;
  }
  const target = (PIECE_PHRASES[board.get(threat.to as Square)?.type ?? ""] ?? "la pièce").replace(/^(le|la) /, "votre ");
  return `${capitalize(attacker)} en ${threat.from} peut prendre ${target} en ${threat.to} (${san}).`;
}
