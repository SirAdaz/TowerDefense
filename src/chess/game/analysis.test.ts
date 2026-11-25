import { describe, expect, it } from "vitest";
import { MATED_PGN, MISSED_MATE_PGN, TEST_USER, analysedGame, cp, mate, moveReview, rawGame } from "../../../tests/chessFixtures.ts";
import { buildPuzzle, findLostPhase, lineToSan, reviewGame, terminalScore } from "./analysis.ts";
import { parseGame } from "./pgn.ts";
import type { EngineLine, EngineScore, ParsedGame, PuzzleCandidate } from "./types.ts";

function parsed(pgn: string): ParsedGame {
  const game = parseGame(pgn);
  if (game === null) {
    throw new Error("Fixture PGN should parse");
  }
  return game;
}

function line(moveUci: string, score: EngineScore, pvUci: string[] = [moveUci]): EngineLine {
  return { moveUci, score, pvUci };
}

/** Évaluations de chaque position de MATED_PGN, pour le camp au trait : tout va bien jusqu'à 3...Cf6. */
const MATED_SCORES = [cp(20), cp(-20), cp(0), cp(-10), cp(10), cp(-30), mate(1), mate(0)];

describe("terminal positions", () => {
  it("scores a checkmate as mate in 0 for the side to move", () => {
    expect(terminalScore(parsed(MATED_PGN).finalFen)).toEqual(mate(0));
  });

  it("scores a stalemate as equal", () => {
    expect(terminalScore("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).toEqual(cp(0));
  });

  it("leaves a playable position to the engine", () => {
    expect(terminalScore("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBeNull();
  });
});

describe("reviewing a game", () => {
  const review = reviewGame(rawGame(), parsed(MATED_PGN), MATED_SCORES, TEST_USER);

  it("reviews only the player's moves, from the player's side", () => {
    expect(review.analysed.moves.map((move) => move.san)).toEqual(["e5", "Nc6", "Nf6"]);
    expect(review.analysed.moves[0]).toMatchObject({ ply: 1, cpBefore: -20, cpAfter: 0, quality: "good", clockSeconds: 179.1 });
    expect(review.analysed.moves[2]).toMatchObject({ ply: 5, cpBefore: -30, cpAfter: -1000, quality: "blunder", clockSeconds: 8.4 });
  });

  it("keeps what the report needs", () => {
    expect(review.analysed).toMatchObject({
      id: "game-1",
      username: TEST_USER,
      timeClass: "blitz",
      result: "loss",
      openingName: "Kings Pawn Opening",
      eco: "C20",
      lostPhase: "opening",
    });
    expect(review.analysed.accuracy).toBeGreaterThan(50);
    expect(review.analysed.accuracy).toBeLessThan(90);
  });

  it("turns the blunder into a puzzle candidate, with the move that led to it", () => {
    expect(review.candidates).toEqual([
      {
        ply: 5,
        fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
        playedUci: "g8f6",
        playedSan: "Nf6",
        kind: "allowedMate",
        previousMoveUci: "f1c4",
      },
    ]);
  });

  it("finds a missed mate when the player has white", () => {
    const scores = [cp(20), cp(-20), cp(30), cp(-30), cp(40), cp(-40), mate(1), cp(-50), cp(60), cp(-60)];
    const whiteGame = rawGame({ pgn: MISSED_MATE_PGN, playerColor: "white", result: "draw" });
    const whiteReview = reviewGame(whiteGame, parsed(MISSED_MATE_PGN), scores, TEST_USER);
    expect(whiteReview.candidates.map((candidate) => [candidate.ply, candidate.kind])).toEqual([[6, "missedMate"]]);
    expect(whiteReview.analysed.lostPhase).toBeNull();
  });

  it("skips moves whose evaluation is missing and gives 0 accuracy to an empty review", () => {
    const empty = reviewGame(rawGame(), parsed(MATED_PGN), [], TEST_USER);
    expect(empty.analysed.moves).toEqual([]);
    expect(empty.analysed.accuracy).toBe(0);
  });
});

describe("phase where a game is lost", () => {
  it("is the phase of the last move that turned a playable position into a losing one", () => {
    const moves = [
      moveReview({ cpBefore: 0, cpAfter: -300, phase: "opening" }),
      moveReview({ cpBefore: -50, cpAfter: -400, phase: "middlegame" }),
      moveReview({ cpBefore: -400, cpAfter: -900, phase: "endgame" }),
    ];
    expect(findLostPhase(moves, "loss")).toBe("middlegame");
  });

  it("is « other » when the game is lost without a losing position", () => {
    expect(findLostPhase([moveReview()], "loss")).toBe("other");
  });

  it("is empty for a game that is not lost", () => {
    expect(findLostPhase([moveReview({ cpBefore: 0, cpAfter: -900 })], "draw")).toBeNull();
  });
});

describe("building a puzzle", () => {
  const game = analysedGame({ playerColor: "black" });
  const candidate: PuzzleCandidate = {
    ply: 5,
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    playedUci: "g8f6",
    playedSan: "Nf6",
    kind: "allowedMate",
    previousMoveUci: "f1c4",
  };
  const mateInOne = { ...candidate, fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", playedUci: "b1c3" };

  it("accepts the best move and the ones nearly as good, not the rest", () => {
    const built = buildPuzzle(game, candidate, [
      line("g7g6", cp(-30), ["g7g6", "h5f3", "g8f6"]),
      line("d8e7", cp(-45)),
      line("d7d6", cp(-400)),
    ]);
    expect(built).toMatchObject({
      id: "game-1:5",
      username: TEST_USER,
      fen: candidate.fen,
      playerColor: "black",
      kind: "allowedMate",
      playedSan: "Nf6",
      previousMoveUci: "f1c4",
      solutions: [
        { uci: "g7g6", san: "g6" },
        { uci: "d8e7", san: "Qe7" },
      ],
      solutionLine: ["g6", "Qf3", "Nf6"],
      review: { step: -1, dueAt: 0 },
    });
  });

  it("drops the puzzle when the deeper search finds the played move good enough", () => {
    expect(buildPuzzle(game, candidate, [line("g7g6", cp(-30)), line("g8f6", cp(-35))])).toBeNull();
  });

  it("only accepts mates when a mate exists, a move longer at most", () => {
    const built = buildPuzzle(game, mateInOne, [
      line("h5f7", mate(1)),
      line("c4f7", mate(2)),
      line("h5e5", mate(4)),
      line("d2d3", cp(900)),
    ]);
    expect(built?.solutions.map((solution) => solution.san)).toEqual(["Qxf7#", "Bxf7+"]);
  });

  it("returns nothing without lines or with an impossible best move", () => {
    expect(buildPuzzle(game, candidate, [])).toBeNull();
    expect(buildPuzzle(game, candidate, [line("a1a8", cp(50)), line("g7g6", cp(40))])).toBeNull();
  });
});

describe("readable lines", () => {
  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("converts moves until one is impossible or malformed", () => {
    expect(lineToSan(START_FEN, ["e2e4", "e7e5", "g1f3"])).toEqual(["e4", "e5", "Nf3"]);
    expect(lineToSan(START_FEN, ["e2e4", "e2e4", "g1f3"])).toEqual(["e4"]);
    expect(lineToSan(START_FEN, ["e2e4", "(none)", "g1f3"])).toEqual(["e4"]);
  });
});
