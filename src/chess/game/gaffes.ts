import { parseGame } from "./pgn.ts";
import type { AnalysedGame, DrillReview, MoveReview, ParsedMove, Puzzle, ReviewState } from "./types.ts";
import { NEW_REVIEW } from "./schedule.ts";

/** Position d'où part une gaffe : celle à rejouer, et le coup adverse qui y a mené. */
export interface GaffePosition {
  readonly move: MoveReview;
  readonly fen: string;
  readonly previousMoveUci: string | null;
}

/** Gaffes d'une partie retenues par `isWanted`, avec leur position, et celles dont la position manque. */
export interface GaffeSelection {
  readonly positions: readonly GaffePosition[];
  /** Vrai si une gaffe retenue n'a pas de position : la partie, analysée avant la revue, est à relire. */
  readonly isMissingPositions: boolean;
}

function puzzleIdOf(gameId: string, ply: number): string {
  return `${gameId}:${ply}`;
}

/** Position d'une gaffe : celle du PGN gardé, sinon celle de son problème, sinon `null`. */
function positionOf(
  move: MoveReview,
  parsedMoves: readonly ParsedMove[] | null,
  puzzle: Puzzle | undefined,
): GaffePosition | null {
  const parsed = parsedMoves?.[move.ply];
  if (parsed !== undefined) {
    return { move, fen: parsed.fenBefore, previousMoveUci: parsedMoves?.[move.ply - 1]?.uci ?? null };
  }
  return puzzle === undefined ? null : { move, fen: puzzle.fen, previousMoveUci: puzzle.previousMoveUci };
}

/**
 * Positions des gaffes d'une partie. Elles viennent du PGN gardé pour la revue ; une partie analysée
 * avant n'a que les positions de ses problèmes, les autres gaffes attendent qu'elle soit relue.
 */
export function gaffePositions(
  game: AnalysedGame,
  puzzlesById: ReadonlyMap<string, Puzzle>,
  isWanted: (move: MoveReview) => boolean,
): GaffeSelection {
  const parsedMoves = game.timeline === undefined ? null : (parseGame(game.timeline.pgn)?.moves ?? null);
  const positions: GaffePosition[] = [];
  let isMissingPositions = false;
  for (const move of game.moves.filter((candidate) => candidate.quality === "blunder" && isWanted(candidate))) {
    const position = positionOf(move, parsedMoves, puzzlesById.get(puzzleIdOf(game.id, move.ply)));
    if (position === null) {
      isMissingPositions = true;
    } else {
      positions.push(position);
    }
  }
  return { positions, isMissingPositions };
}

/** Index des problèmes par identifiant. */
export function indexPuzzles(puzzles: readonly Puzzle[]): ReadonlyMap<string, Puzzle> {
  return new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
}

/** État de révision gardé pour un exercice, ou celui d'un exercice jamais tenté. */
export function reviewOf(reviews: ReadonlyMap<string, DrillReview>, id: string): ReviewState {
  return reviews.get(id)?.review ?? NEW_REVIEW;
}

export function indexReviews(reviews: readonly DrillReview[]): ReadonlyMap<string, DrillReview> {
  return new Map(reviews.map((stored) => [stored.id, stored]));
}
