import { describe, expect, it } from "vitest";
import { analysedGame, moveReview } from "../../../tests/chessFixtures.ts";
import { MAX_OPENINGS, buildReport, openingStats } from "./report.ts";

const blunder = (clockSeconds: number | null) => moveReview({ quality: "blunder", clockSeconds });
const mistake = (clockSeconds: number | null) => moveReview({ quality: "mistake", clockSeconds });
const good = (clockSeconds: number | null) => moveReview({ quality: "good", clockSeconds });

describe("report by time class", () => {
  const games = [
    analysedGame({ id: "b1", timeClass: "blitz", result: "win", accuracy: 90, moves: [good(100), good(60), mistake(40)] }),
    analysedGame({
      id: "b2",
      timeClass: "blitz",
      result: "loss",
      accuracy: 70,
      lostPhase: "endgame",
      moves: [good(100), blunder(9.9), blunder(4), good(3), mistake(10)],
    }),
    analysedGame({ id: "b3", timeClass: "blitz", result: "draw", accuracy: 80, moves: [good(100)] }),
    analysedGame({ id: "r1", timeClass: "rapid", result: "loss", accuracy: 50, lostPhase: "opening", moves: [blunder(500)] }),
    analysedGame({ id: "skipped", timeClass: "blitz", result: "loss", accuracy: 0, moves: [] }),
  ];

  it("never mixes time classes and ignores games without reviewed moves", () => {
    const blitz = buildReport(games, "blitz");
    expect(blitz).toMatchObject({ timeClass: "blitz", gameCount: 3, winCount: 1, drawCount: 1, lossCount: 1 });
    expect(buildReport(games, "rapid")).toMatchObject({ gameCount: 1, lossCount: 1, accuracy: 50, blundersPerGame: 1 });
  });

  it("returns nothing for a time class never played", () => {
    expect(buildReport(games, "bullet")).toBeNull();
    expect(buildReport([analysedGame({ timeClass: "bullet", moves: [] })], "bullet")).toBeNull();
  });

  it("averages accuracy, blunders and mistakes per game", () => {
    const blitz = buildReport(games, "blitz");
    expect(blitz?.accuracy).toBeCloseTo(80);
    expect(blitz?.blundersPerGame).toBeCloseTo(2 / 3);
    expect(blitz?.mistakesPerGame).toBeCloseTo(2 / 3);
  });

  it("counts lost games by the phase where they turned", () => {
    expect(buildReport(games, "blitz")?.lostPhases).toEqual({ opening: 0, middlegame: 0, endgame: 1, other: 0 });
    expect(buildReport(games, "rapid")?.lostPhases).toEqual({ opening: 1, middlegame: 0, endgame: 0, other: 0 });
  });

  it("compares the error rate under ten seconds with the rest of the game", () => {
    const blitz = buildReport(games, "blitz");
    expect(blitz?.lowClock).toMatchObject({ moveCount: 3, errorCount: 2 });
    expect(blitz?.lowClock?.errorRate).toBeCloseTo(66.67, 1);
    expect(blitz?.otherClock).toMatchObject({ moveCount: 6, errorCount: 2 });
    expect(blitz?.otherClock?.errorRate).toBeCloseTo(33.33, 1);
  });

  it("says nothing about the clock when the games have none", () => {
    const report = buildReport([analysedGame({ moves: [blunder(null), good(null)] })], "blitz");
    expect(report?.lowClock).toBeNull();
    expect(report?.otherClock).toBeNull();
    expect(report?.blundersPerGame).toBe(1);
  });

  it("gives a zero rate when no move was played under ten seconds", () => {
    expect(buildReport(games, "rapid")?.lowClock).toEqual({ moveCount: 0, errorCount: 0, errorRate: 0 });
  });
});

describe("openings", () => {
  it("groups by name with the win rate, most played first then alphabetical", () => {
    const stats = openingStats([
      analysedGame({ openingName: "Sicilian Defense", result: "loss" }),
      analysedGame({ openingName: "Italian Game", result: "win" }),
      analysedGame({ openingName: "Italian Game", result: "draw" }),
      analysedGame({ openingName: "Caro Kann Defense", result: "win" }),
    ]);
    expect(stats).toEqual([
      { name: "Italian Game", gameCount: 2, winCount: 1, winRate: 50, pgn: null },
      { name: "Caro Kann Defense", gameCount: 1, winCount: 1, winRate: 100, pgn: null },
      { name: "Sicilian Defense", gameCount: 1, winCount: 0, winRate: 0, pgn: null },
    ]);
  });

  it("keeps the PGN of the latest game that has one, to show the opening moves", () => {
    const timeline = (pgn: string) => ({ pgn, scores: [], bestMoves: [] });
    const stats = openingStats([
      analysedGame({ endTime: 10, timeline: timeline("old") }),
      analysedGame({ endTime: 30 }),
      analysedGame({ endTime: 20, timeline: timeline("recent") }),
    ]);
    expect(stats[0]?.pgn).toBe("recent");
  });

  it("keeps only the most played openings", () => {
    const many = Array.from({ length: MAX_OPENINGS + 3 }, (_, index) => analysedGame({ openingName: `Opening ${index}` }));
    expect(openingStats(many)).toHaveLength(MAX_OPENINGS);
  });
});
