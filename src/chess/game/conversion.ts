import { Chess } from "chess.js";
import { CP_LIMIT, toPlayerView } from "./evaluation.ts";
import { gaffePositions, indexPuzzles, indexReviews, reviewOf } from "./gaffes.ts";
import type { AnalysedGame, ConversionDrill, DrillReview, EngineScore, Puzzle } from "./types.ts";
import { parseUciMove } from "./uci.ts";

/** Une position vaut « gagnante » à partir de +1,5 pion pour le joueur : assez pour gagner sans miracle. */
export const WINNING_CP = 150;

/** Nombre de coups du joueur à tenir : après eux, l'avantage doit toujours valoir `WINNING_CP`. */
export const CONVERSION_MOVES = 10;

/** Sous +1 pion après un coup du joueur, l'avantage est perdu : l'exercice est raté. */
export const LOST_ADVANTAGE_CP = 100;

/** À +10 pions (sans mat en vue), le moteur abandonne : la partie est gagnée. */
export const RESIGN_CP = CP_LIMIT;

export type ConversionEnd = "mate" | "held" | "resigned" | "dropped" | "notEnough" | "draw" | "mated";

/** Où en est une partie jouée depuis la position : en cours, gagnée ou ratée (et pourquoi). */
export type ConversionVerdict =
  | { readonly status: "playing" }
  | { readonly status: "won"; readonly reason: "mate" | "held" | "resigned" }
  | { readonly status: "lost"; readonly reason: "dropped" | "notEnough" | "draw" | "mated" };

const PLAYING: ConversionVerdict = { status: "playing" };

export function conversionId(gameId: string, ply: number): string {
  return `${gameId}:${ply}:convert`;
}

/**
 * Exercices « convertir un avantage » : chaque gaffe faite alors que le joueur valait au moins
 * +1,5 pion, à rejouer depuis la position d'avant la gaffe. `gamesToPrepare` : parties analysées
 * avant la revue dont une gaffe n'a pas encore de position (à relire pour la retrouver).
 */
export function selectConversionDrills(
  games: readonly AnalysedGame[],
  puzzles: readonly Puzzle[],
  reviews: readonly DrillReview[],
): { readonly drills: ConversionDrill[]; readonly gamesToPrepare: AnalysedGame[] } {
  const puzzlesById = indexPuzzles(puzzles);
  const reviewsById = indexReviews(reviews);
  const drills: ConversionDrill[] = [];
  const gamesToPrepare: AnalysedGame[] = [];
  for (const game of games) {
    const selection = gaffePositions(game, puzzlesById, (move) => move.cpBefore >= WINNING_CP);
    if (selection.isMissingPositions) {
      gamesToPrepare.push(game);
    }
    for (const position of selection.positions) {
      const id = conversionId(game.id, position.move.ply);
      drills.push({
        id,
        username: game.username,
        gameUrl: game.url,
        timeClass: game.timeClass,
        gameEndTime: game.endTime,
        fen: position.fen,
        playerColor: game.playerColor,
        previousMoveUci: position.previousMoveUci,
        startCp: position.move.cpBefore,
        playedSan: position.move.san,
        review: reviewOf(reviewsById, id),
      });
    }
  }
  return { drills, gamesToPrepare };
}

/** Rejoue les coups depuis la position de départ : l'historique compte pour la nulle par répétition. */
export function replay(startFen: string, movesUci: readonly string[]): Chess {
  const chess = new Chess(startFen);
  for (const uci of movesUci) {
    const move = parseUciMove(uci);
    if (move === null) {
      break;
    }
    try {
      chess.move(move);
    } catch {
      break;
    }
  }
  return chess;
}

/**
 * Verdict après un coup du joueur. `score` évalue la position d'après, pour l'adversaire au trait.
 * Mat : gagné. Nulle : raté. Sous +1 pion : raté. À +10 pions : le moteur abandonne. Après
 * `CONVERSION_MOVES` coups : gagné si l'on vaut encore +1,5 pion, raté sinon.
 */
export function judgePlayerMove(game: Chess, score: EngineScore | null, playerMoves: number): ConversionVerdict {
  if (game.isCheckmate()) {
    return { status: "won", reason: "mate" };
  }
  if (game.isGameOver()) {
    return { status: "lost", reason: "draw" };
  }
  if (score === null) {
    return PLAYING;
  }
  const view = toPlayerView(score, false);
  if (view.cp < LOST_ADVANTAGE_CP) {
    return { status: "lost", reason: "dropped" };
  }
  if (view.mate === "none" && view.cp >= RESIGN_CP) {
    return { status: "won", reason: "resigned" };
  }
  if (playerMoves >= CONVERSION_MOVES) {
    return view.cp >= WINNING_CP ? { status: "won", reason: "held" } : { status: "lost", reason: "notEnough" };
  }
  return PLAYING;
}

/** Verdict après la réponse de l'adversaire : seul un mat ou une nulle arrête la partie. */
export function judgeReply(game: Chess): ConversionVerdict {
  if (game.isCheckmate()) {
    return { status: "lost", reason: "mated" };
  }
  return game.isGameOver() ? { status: "lost", reason: "draw" } : PLAYING;
}
