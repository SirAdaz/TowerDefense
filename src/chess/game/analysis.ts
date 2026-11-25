import { Chess } from "chess.js";
import { classifyMove, moveAccuracy, puzzleKind, toPlayerView, winPercent } from "./evaluation.ts";
import type { PlayerView } from "./evaluation.ts";
import { phaseOf } from "./pgn.ts";
import { NEW_REVIEW } from "./schedule.ts";
import type {
  AnalysedGame,
  EngineLine,
  EngineScore,
  GameResult,
  LostPhase,
  MoveReview,
  ParsedGame,
  Puzzle,
  PuzzleCandidate,
  PuzzleMove,
  RawGame,
} from "./types.ts";
import { parseUciMove } from "./uci.ts";

/** En dessous de cette évaluation (vue du joueur), la partie est tenue pour perdante. */
export const LOSING_CP = -200;

/** Un autre coup est accepté s'il garde les chances de gain à moins de 3 points du meilleur. */
export const NEAR_BEST_WIN_DROP = 3;

/** Un mat plus long d'un coup que le plus court reste une bonne réponse. */
const NEAR_BEST_MATE_EXTRA_MOVES = 1;

const SOLUTION_LINE_MAX_PLIES = 6;

export interface GameReview {
  readonly analysed: AnalysedGame;
  readonly candidates: readonly PuzzleCandidate[];
}

/**
 * Évaluation d'une position terminale, que le moteur ne sait pas chercher (aucun coup légal) :
 * mat = « mat en 0 » pour le camp au trait, sinon nulle. `null` si la partie peut continuer.
 */
export function terminalScore(fen: string): EngineScore | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    return { kind: "mate", value: 0 };
  }
  return chess.isGameOver() ? { kind: "cp", value: 0 } : null;
}

/**
 * Phase du dernier coup qui a fait passer le joueur d'une position tenable à une position perdante.
 * Sans bascule (perdu au temps ou abandon dans une position jouable) : `other`.
 */
export function findLostPhase(moves: readonly MoveReview[], result: GameResult): LostPhase | null {
  if (result !== "loss") {
    return null;
  }
  const turningPoint = moves.findLast((move) => move.cpBefore > LOSING_CP && move.cpAfter <= LOSING_CP);
  return turningPoint?.phase ?? "other";
}

function average(numbers: readonly number[]): number {
  return numbers.length === 0 ? 0 : numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
}

/**
 * Passe en revue les coups du joueur. `scores[i]` évalue la position avant le demi-coup `i`
 * (camp au trait), le dernier évalue la position finale : une évaluation de plus que de coups.
 */
export function reviewGame(game: RawGame, parsed: ParsedGame, scores: readonly EngineScore[], username: string): GameReview {
  const moves: MoveReview[] = [];
  const candidates: PuzzleCandidate[] = [];
  parsed.moves.forEach((move, ply) => {
    const scoreBefore = scores[ply];
    const scoreAfter = scores[ply + 1];
    if (move.color !== game.playerColor || scoreBefore === undefined || scoreAfter === undefined) {
      return;
    }
    const before = toPlayerView(scoreBefore, true);
    const after = toPlayerView(scoreAfter, false);
    moves.push({
      ply,
      san: move.san,
      cpBefore: before.cp,
      cpAfter: after.cp,
      quality: classifyMove(before.cp, after.cp),
      phase: phaseOf(move.fenBefore, ply),
      clockSeconds: move.clockSeconds,
    });
    const kind = puzzleKind(before, after);
    if (kind !== null) {
      const previousMoveUci = parsed.moves[ply - 1]?.uci ?? null;
      candidates.push({ ply, fen: move.fenBefore, playedUci: move.uci, playedSan: move.san, kind, previousMoveUci });
    }
  });
  const analysed: AnalysedGame = {
    id: game.id,
    url: game.url,
    username,
    timeClass: game.timeClass,
    endTime: game.endTime,
    playerColor: game.playerColor,
    result: game.result,
    openingName: parsed.openingName,
    eco: parsed.eco,
    accuracy: average(moves.map((move) => moveAccuracy(move.cpBefore, move.cpAfter))),
    moves,
    lostPhase: findLostPhase(moves, game.result),
  };
  return { analysed, candidates };
}

function isNearBest(best: PlayerView, other: PlayerView): boolean {
  if (best.mate === "winning") {
    return other.mate === "winning" && other.mateMoves <= best.mateMoves + NEAR_BEST_MATE_EXTRA_MOVES;
  }
  return winPercent(best.cp) - winPercent(other.cp) <= NEAR_BEST_WIN_DROP;
}

/** Joue une suite de coups UCI et renvoie leur notation lisible ; s'arrête au premier coup impossible. */
export function lineToSan(fen: string, pvUci: readonly string[]): string[] {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];
  for (const uci of pvUci) {
    const move = parseUciMove(uci);
    if (move === null) {
      break;
    }
    try {
      sanMoves.push(chess.move(move).san);
    } catch {
      break;
    }
  }
  return sanMoves;
}

function toPuzzleMove(fen: string, line: EngineLine): PuzzleMove | null {
  const san = lineToSan(fen, [line.moveUci])[0];
  return san === undefined ? null : { uci: line.moveUci, san };
}

/**
 * Transforme une position candidate en problème à partir des meilleures variantes du moteur (la
 * meilleure en premier). `null` quand la recherche approfondie range le coup joué parmi les bons :
 * la gaffe n'en était pas une, ou plusieurs coups se valent et le problème serait injuste.
 */
export function buildPuzzle(game: AnalysedGame, candidate: PuzzleCandidate, lines: readonly EngineLine[]): Puzzle | null {
  const bestLine = lines[0];
  if (bestLine === undefined) {
    return null;
  }
  const best = toPlayerView(bestLine.score, true);
  const acceptedLines = lines.filter((line) => isNearBest(best, toPlayerView(line.score, true)));
  const solutions = acceptedLines.map((line) => toPuzzleMove(candidate.fen, line)).filter((move) => move !== null);
  const isPlayedMoveAccepted = solutions.some((solution) => solution.uci === candidate.playedUci);
  if (solutions[0]?.uci !== bestLine.moveUci || isPlayedMoveAccepted) {
    return null;
  }
  return {
    id: `${game.id}:${candidate.ply}`,
    username: game.username,
    gameUrl: game.url,
    timeClass: game.timeClass,
    gameEndTime: game.endTime,
    fen: candidate.fen,
    playerColor: game.playerColor,
    kind: candidate.kind,
    playedSan: candidate.playedSan,
    previousMoveUci: candidate.previousMoveUci,
    solutions,
    solutionLine: lineToSan(candidate.fen, bestLine.pvUci.slice(0, SOLUTION_LINE_MAX_PLIES)),
    review: NEW_REVIEW,
  };
}
