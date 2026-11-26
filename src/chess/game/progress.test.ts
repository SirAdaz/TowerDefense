import { describe, expect, it } from "vitest";
import { analysedGame, moveReview } from "../../../tests/chessFixtures.ts";
import { weekStartOf, weeklyProgress } from "./progress.ts";

/** Lundi 16 novembre 2026, 00:00 UTC, en secondes. */
const MONDAY = Date.UTC(2026, 10, 16) / 1000;
const HOUR = 3600;
const DAY = 24 * HOUR;
const PARIS_WINTER = -60;

describe("weekStartOf", () => {
  it("ramène toute la semaine au lundi", () => {
    expect(weekStartOf(MONDAY + 10 * HOUR, 0)).toBe(MONDAY * 1000);
    expect(weekStartOf(MONDAY + 6 * DAY + 23 * HOUR, 0)).toBe(MONDAY * 1000);
    expect(weekStartOf(MONDAY + 7 * DAY, 0)).toBe((MONDAY + 7 * DAY) * 1000);
  });

  it("garde dans sa semaine une partie du dimanche soir, heure du joueur", () => {
    const sundayLateUtc = MONDAY - 30 * 60;
    expect(weekStartOf(sundayLateUtc, 0)).toBe((MONDAY - 7 * DAY) * 1000);
    expect(weekStartOf(sundayLateUtc, PARIS_WINTER)).toBe(MONDAY * 1000);
  });
});

describe("weeklyProgress", () => {
  const blunder = moveReview({ ply: 2, quality: "blunder" });
  const good = moveReview({ ply: 4 });

  it("moyenne la précision et compte les gaffes par partie, semaine par semaine", () => {
    const games = [
      analysedGame({ id: "a", endTime: MONDAY + 8 * DAY, accuracy: 80, moves: [good] }),
      analysedGame({ id: "b", endTime: MONDAY + DAY, accuracy: 60, moves: [blunder, blunder] }),
      analysedGame({ id: "c", endTime: MONDAY + 2 * DAY, accuracy: 70, moves: [blunder, good] }),
    ];
    expect(weeklyProgress(games, "blitz", 0)).toEqual([
      { weekStart: MONDAY * 1000, gameCount: 2, accuracy: 65, blundersPerGame: 1.5 },
      { weekStart: (MONDAY + 7 * DAY) * 1000, gameCount: 1, accuracy: 80, blundersPerGame: 0 },
    ]);
  });

  it("ne mélange pas les cadences et ignore les parties sans coup évalué", () => {
    const games = [
      analysedGame({ id: "a", timeClass: "rapid", endTime: MONDAY, moves: [good] }),
      analysedGame({ id: "b", endTime: MONDAY, moves: [] }),
    ];
    expect(weeklyProgress(games, "blitz", 0)).toEqual([]);
    expect(weeklyProgress(games, "rapid", 0)).toHaveLength(1);
  });
});
