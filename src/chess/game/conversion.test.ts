import { describe, expect, it } from "vitest";
import { MATED_PGN, TEST_USER, analysedGame, cp, mate, moveReview, puzzle } from "../../../tests/chessFixtures.ts";
import {
  CONVERSION_MOVES,
  conversionId,
  judgePlayerMove,
  judgeReply,
  replay,
  selectConversionDrills,
} from "./conversion.ts";
import { parseGame } from "./pgn.ts";
import type { AnalysedGame } from "./types.ts";

/** Position avant 3...Cf6 ?? (noirs au trait) dans la partie du mat du berger. */
const BEFORE_NF6 = parseGame(MATED_PGN)?.moves[5]?.fenBefore ?? "";

/** Le joueur (noirs) vaut +3 avant 3...Cf6 ??, qui laisse le mat : une gaffe en position gagnante. */
function winningGaffeGame(overrides: Partial<AnalysedGame> = {}): AnalysedGame {
  return analysedGame({
    id: "game-7",
    playerColor: "black",
    result: "loss",
    moves: [
      moveReview({ ply: 1, san: "e5", cpBefore: 300, cpAfter: 280 }),
      moveReview({ ply: 3, san: "Nc6", cpBefore: 120, cpAfter: -150, quality: "blunder" }),
      moveReview({ ply: 5, san: "Nf6", cpBefore: 300, cpAfter: -1000, quality: "blunder" }),
    ],
    ...overrides,
  });
}

const WITH_TIMELINE = { timeline: { pgn: MATED_PGN, scores: [], bestMoves: [] } };

describe("selectConversionDrills", () => {
  it("garde les gaffes faites à +1,5 ou mieux, avec la position d'avant la gaffe", () => {
    const { drills, gamesToPrepare } = selectConversionDrills([winningGaffeGame(WITH_TIMELINE)], [], []);
    expect(drills).toHaveLength(1);
    expect(drills[0]).toMatchObject({
      id: conversionId("game-7", 5),
      username: TEST_USER,
      fen: BEFORE_NF6,
      previousMoveUci: "f1c4",
      startCp: 300,
      playedSan: "Nf6",
      playerColor: "black",
      review: { step: -1 },
    });
    expect(gamesToPrepare).toEqual([]);
  });

  it("reprend l'état de révision gardé", () => {
    const review = { step: 2, dueAt: 42, attempts: 3, successes: 2 };
    const { drills } = selectConversionDrills([winningGaffeGame(WITH_TIMELINE)], [], [{ id: conversionId("game-7", 5), username: TEST_USER, review }]);
    expect(drills[0]?.review).toEqual(review);
  });

  it("sans PGN gardé, prend la position du problème, ou signale la partie à relire", () => {
    const oldGame = winningGaffeGame();
    const fromPuzzle = selectConversionDrills([oldGame], [puzzle({ id: "game-7:5", fen: "fen-du-probleme", previousMoveUci: "a1a2" })], []);
    expect(fromPuzzle.drills[0]).toMatchObject({ fen: "fen-du-probleme", previousMoveUci: "a1a2" });
    expect(fromPuzzle.gamesToPrepare).toEqual([]);
    const missing = selectConversionDrills([oldGame], [], []);
    expect(missing.drills).toEqual([]);
    expect(missing.gamesToPrepare).toEqual([oldGame]);
  });

  it("ignore les parties sans gaffe gagnante", () => {
    const quiet = analysedGame({ moves: [moveReview({ cpBefore: 400, cpAfter: 350, quality: "inaccuracy" })] });
    expect(selectConversionDrills([quiet], [], [])).toEqual({ drills: [], gamesToPrepare: [] });
  });
});

describe("judgePlayerMove", () => {
  const start = puzzle().fen;

  it("gagne sur un mat", () => {
    expect(judgePlayerMove(replay(start, ["h5f7"]), null, 1)).toEqual({ status: "won", reason: "mate" });
  });

  it("rate sur une nulle (pat)", () => {
    expect(judgePlayerMove(replay("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", []), cp(0), 1)).toEqual({ status: "lost", reason: "draw" });
  });

  it("rate quand l'avantage passe sous +1 pion, continue au-dessus", () => {
    const game = replay(start, ["b1c3"]);
    expect(judgePlayerMove(game, cp(-50), 1)).toEqual({ status: "lost", reason: "dropped" });
    expect(judgePlayerMove(game, cp(-300), 1)).toEqual({ status: "playing" });
    expect(judgePlayerMove(game, null, 1)).toEqual({ status: "playing" });
  });

  it("fait abandonner le moteur à +10 pions, mais laisse finir un mat annoncé", () => {
    const game = replay(start, ["b1c3"]);
    expect(judgePlayerMove(game, cp(-1500), 1)).toEqual({ status: "won", reason: "resigned" });
    expect(judgePlayerMove(game, mate(-3), 1)).toEqual({ status: "playing" });
  });

  it("au bout des coups à tenir, gagne à +1,5 ou mieux, rate en dessous", () => {
    const game = replay(start, ["b1c3"]);
    expect(judgePlayerMove(game, cp(-200), CONVERSION_MOVES)).toEqual({ status: "won", reason: "held" });
    expect(judgePlayerMove(game, cp(-120), CONVERSION_MOVES)).toEqual({ status: "lost", reason: "notEnough" });
    expect(judgePlayerMove(game, mate(-2), CONVERSION_MOVES)).toEqual({ status: "won", reason: "held" });
  });
});

describe("judgeReply et replay", () => {
  it("rate quand l'adversaire mate, continue sinon", () => {
    expect(judgeReply(replay(BEFORE_NF6, ["g8f6", "h5f7"]))).toEqual({ status: "lost", reason: "mated" });
    expect(judgeReply(replay(BEFORE_NF6, ["g7g6"]))).toEqual({ status: "playing" });
  });

  it("compte la répétition de la position comme une nulle", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    expect(judgeReply(replay("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", shuffle))).toEqual({
      status: "lost",
      reason: "draw",
    });
  });

  it("s'arrête au premier coup illisible ou illégal", () => {
    expect(replay(BEFORE_NF6, ["zz", "g8f6"]).fen()).toBe(BEFORE_NF6);
    expect(replay(BEFORE_NF6, ["a1a8"]).fen()).toBe(BEFORE_NF6);
  });
});
