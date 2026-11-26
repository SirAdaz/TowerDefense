import { indexReviews, reviewOf } from "./gaffes.ts";
import { parseGame } from "./pgn.ts";
import { detectThreat } from "./threats.ts";
import type { AnalysedGame, DefenseDrill, DrillReview, GameTimeline, MoveReview, ParsedMove } from "./types.ts";

export function defenseId(gameId: string, ply: number): string {
  return `${gameId}:${ply}:defend`;
}

interface GameMoves {
  readonly game: AnalysedGame;
  readonly timeline: GameTimeline;
  readonly parsedMoves: readonly ParsedMove[];
}

function toDrill(source: GameMoves, move: MoveReview, reviews: ReadonlyMap<string, DrillReview>): DefenseDrill | null {
  const { game, timeline, parsedMoves } = source;
  const parsed = parsedMoves[move.ply];
  const punishUci = timeline.bestMoves[move.ply + 1] ?? "";
  const threat = parsed === undefined || punishUci === "" ? null : detectThreat(parsed.fenBefore, punishUci);
  if (parsed === undefined || threat === null) {
    return null;
  }
  const id = defenseId(game.id, move.ply);
  return {
    id,
    username: game.username,
    gameUrl: game.url,
    timeClass: game.timeClass,
    gameEndTime: game.endTime,
    fen: parsed.fenBefore,
    playerColor: game.playerColor,
    previousMoveUci: parsedMoves[move.ply - 1]?.uci ?? null,
    cpBefore: move.cpBefore,
    playedSan: move.san,
    playedUci: parsed.uci,
    bestUci: timeline.bestMoves[move.ply] ?? "",
    threat,
    review: reviewOf(reviews, id),
  };
}

/**
 * Problèmes de défense : gaffes du joueur qui ont laissé passer une menace déjà présente (le coup
 * qui les a punies, selon le moteur, était jouable avant : prise gagnante ou mat). Il faut les
 * positions et les meilleurs coups gardés pour la revue : `gamesToPrepare` liste les parties
 * analysées avant, avec au moins une gaffe, qui sont à relire.
 */
export function selectDefenseDrills(
  games: readonly AnalysedGame[],
  reviews: readonly DrillReview[],
): { readonly drills: DefenseDrill[]; readonly gamesToPrepare: AnalysedGame[] } {
  const reviewsById = indexReviews(reviews);
  const drills: DefenseDrill[] = [];
  const gamesToPrepare: AnalysedGame[] = [];
  for (const game of games) {
    const blunders = game.moves.filter((move) => move.quality === "blunder");
    const parsedMoves = game.timeline === undefined ? null : (parseGame(game.timeline.pgn)?.moves ?? null);
    if (game.timeline === undefined || parsedMoves === null) {
      gamesToPrepare.push(...(blunders.length > 0 && game.timeline === undefined ? [game] : []));
      continue;
    }
    const source: GameMoves = { game, timeline: game.timeline, parsedMoves };
    drills.push(...blunders.map((move) => toDrill(source, move, reviewsById)).filter((drill) => drill !== null));
  }
  return { drills, gamesToPrepare };
}
