import { moveAccuracy, toPlayerView, winPercent } from "./evaluation.ts";
import { classifyFacts, isSacrifice, MOVE_CLASS_ORDER } from "./moveClass.ts";
import type { MoveClass } from "./moveClass.ts";
import { parseGame, parseTimeControl, pgnHeader } from "./pgn.ts";
import type { TimeControl } from "./pgn.ts";
import type { EngineScore, GameTimeline, ParsedMove, PlayerColor } from "./types.ts";

/** Pendule sous laquelle un coup est joué « en zeitnot » (même seuil que le bilan). */
export const ZEITNOT_SECONDS = 10;

/** Coup long : au moins 1/15 du temps de départ (12 s en 3 min, 4 s en 1 min), et 3 s au minimum. */
export const LONG_THINK_SHARE = 1 / 15;
export const LONG_THINK_MIN_SECONDS = 3;

/** Un demi-coup revu : l'avis, l'évaluation, le meilleur coup du moteur et le temps passé. */
export interface PlyReview {
  readonly ply: number;
  readonly color: PlayerColor;
  readonly san: string;
  readonly uci: string;
  readonly fenBefore: string;
  readonly moveClass: MoveClass;
  /** Chances de gain (0-100) des blancs après le coup : la courbe de la partie. */
  readonly whiteWinAfter: number;
  /** Meilleur coup du moteur dans la position d'avant ; "" s'il manque. */
  readonly bestUci: string;
  readonly accuracy: number;
  /** Pendule après le coup et temps passé dessus (secondes) ; `null` sans pendule. */
  readonly clockSeconds: number | null;
  readonly spentSeconds: number | null;
  readonly isZeitnot: boolean;
  readonly isLongThink: boolean;
}

export interface SideSummary {
  /** Précision moyenne des coups du camp (0-100). */
  readonly accuracy: number;
  readonly counts: Readonly<Record<MoveClass, number>>;
}

export interface GameReviewData {
  readonly startFen: string;
  readonly finalFen: string;
  readonly plies: readonly PlyReview[];
  /** Chances de gain des blancs dans la position de départ. */
  readonly whiteWinStart: number;
  readonly white: SideSummary;
  readonly black: SideSummary;
  readonly timeControl: TimeControl | null;
  readonly whiteName: string;
  readonly blackName: string;
}

const DRAW_SCORE: EngineScore = { kind: "cp", value: 0 };

function whiteWinOf(score: EngineScore, fen: string): number {
  const isWhiteToMove = fen.split(" ")[1] !== "b";
  return winPercent(toPlayerView(score, isWhiteToMove).cp);
}

/** Temps passé sur un coup : pendule d'avant (ou temps de départ) moins pendule d'après, plus l'ajout. */
function previousClock(moves: readonly ParsedMove[], ply: number, timeControl: TimeControl | null): number | null {
  if (ply < 2) {
    return timeControl === null ? null : timeControl.baseSeconds;
  }
  return moves[ply - 2]?.clockSeconds ?? null;
}

/** L'ajout par coup n'est pas compté au premier coup de chaque camp : la pendule part du temps de départ. */
function incrementFor(ply: number, timeControl: TimeControl | null): number {
  return ply < 2 || timeControl === null ? 0 : timeControl.incrementSeconds;
}

export function spentSeconds(moves: readonly ParsedMove[], ply: number, timeControl: TimeControl | null): number | null {
  const clock = moves[ply]?.clockSeconds ?? null;
  const previous = previousClock(moves, ply, timeControl);
  if (clock === null || previous === null) {
    return null;
  }
  return Math.max(0, Math.round((previous - clock + incrementFor(ply, timeControl)) * 10) / 10);
}

function isLongThink(spent: number | null, timeControl: TimeControl | null): boolean {
  const threshold = Math.max(LONG_THINK_MIN_SECONDS, (timeControl?.baseSeconds ?? 0) * LONG_THINK_SHARE);
  return spent !== null && spent >= threshold;
}

interface PlyContext {
  readonly moves: readonly ParsedMove[];
  readonly finalFen: string;
  readonly timeline: GameTimeline;
  readonly timeControl: TimeControl | null;
}

function reviewPly(context: PlyContext, ply: number, opponentLoss: number): { review: PlyReview; loss: number } {
  const { moves, timeline, timeControl } = context;
  const move = moves[ply] as ParsedMove;
  const before = toPlayerView(timeline.scores[ply] ?? DRAW_SCORE, true);
  const after = toPlayerView(timeline.scores[ply + 1] ?? DRAW_SCORE, false);
  const winBefore = winPercent(before.cp);
  const winAfter = winPercent(after.cp);
  const loss = Math.max(0, winBefore - winAfter);
  const bestUci = timeline.bestMoves[ply] ?? "";
  const moveClass = classifyFacts({
    loss,
    isBest: bestUci === move.uci,
    isSacrifice: isSacrifice(move.fenBefore, move.uci),
    opponentLoss,
    winBefore,
    winAfter,
  });
  const fenAfter = moves[ply + 1]?.fenBefore ?? context.finalFen;
  const spent = spentSeconds(moves, ply, timeControl);
  const review: PlyReview = {
    ply,
    color: move.color,
    san: move.san,
    uci: move.uci,
    fenBefore: move.fenBefore,
    moveClass,
    whiteWinAfter: whiteWinOf(timeline.scores[ply + 1] ?? DRAW_SCORE, fenAfter),
    bestUci,
    accuracy: moveAccuracy(before.cp, after.cp),
    clockSeconds: move.clockSeconds,
    spentSeconds: spent,
    isZeitnot: move.clockSeconds !== null && move.clockSeconds < ZEITNOT_SECONDS,
    isLongThink: isLongThink(spent, timeControl),
  };
  return { review, loss };
}

function summarize(plies: readonly PlyReview[], color: PlayerColor): SideSummary {
  const own = plies.filter((ply) => ply.color === color);
  const counts = Object.fromEntries(MOVE_CLASS_ORDER.map((moveClass) => [moveClass, 0])) as Record<MoveClass, number>;
  own.forEach((ply) => {
    counts[ply.moveClass] += 1;
  });
  const accuracy = own.length === 0 ? 0 : own.reduce((total, ply) => total + ply.accuracy, 0) / own.length;
  return { accuracy, counts };
}

/**
 * Revue complète d'une partie à partir de ce que l'analyse a gardé : un avis par demi-coup des deux
 * camps, la courbe d'évaluation, le temps passé et le résumé par camp. `null` si le PGN est illisible
 * ou si les évaluations ne correspondent pas aux coups.
 */
export function buildGameReview(timeline: GameTimeline): GameReviewData | null {
  const parsed = parseGame(timeline.pgn);
  if (parsed === null || timeline.scores.length !== parsed.moves.length + 1) {
    return null;
  }
  const context: PlyContext = { moves: parsed.moves, finalFen: parsed.finalFen, timeline, timeControl: parseTimeControl(timeline.pgn) };
  const plies: PlyReview[] = [];
  let previousLoss = 0;
  parsed.moves.forEach((_move, ply) => {
    const { review, loss } = reviewPly(context, ply, previousLoss);
    plies.push(review);
    previousLoss = loss;
  });
  const startFen = parsed.moves[0]?.fenBefore ?? parsed.finalFen;
  return {
    startFen,
    finalFen: parsed.finalFen,
    plies,
    whiteWinStart: whiteWinOf(timeline.scores[0] ?? DRAW_SCORE, startFen),
    white: summarize(plies, "white"),
    black: summarize(plies, "black"),
    timeControl: context.timeControl,
    whiteName: pgnHeader(timeline.pgn, "White") ?? "Blancs",
    blackName: pgnHeader(timeline.pgn, "Black") ?? "Noirs",
  };
}
