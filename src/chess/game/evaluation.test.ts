import { describe, expect, it } from "vitest";
import { cp, mate } from "../../../tests/chessFixtures.ts";
import { CP_LIMIT, classifyMove, moveAccuracy, puzzleKind, toPlayerView, winPercent } from "./evaluation.ts";

describe("player view of an engine score", () => {
  it("keeps the sign when the player is to move and flips it otherwise", () => {
    expect(toPlayerView(cp(150), true).cp).toBe(150);
    expect(toPlayerView(cp(150), false).cp).toBe(-150);
    expect(Object.is(toPlayerView(cp(0), false).cp, 0)).toBe(true);
  });

  it("caps huge evaluations", () => {
    expect(toPlayerView(cp(4200), true).cp).toBe(CP_LIMIT);
    expect(toPlayerView(cp(4200), false).cp).toBe(-CP_LIMIT);
  });

  it("knows who delivers the mate", () => {
    expect(toPlayerView(mate(3), true)).toEqual({ cp: CP_LIMIT, mate: "winning", mateMoves: 3 });
    expect(toPlayerView(mate(-2), true)).toEqual({ cp: -CP_LIMIT, mate: "losing", mateMoves: 2 });
    expect(toPlayerView(mate(2), false).mate).toBe("losing");
  });

  it("reads « mate in 0 » as the side to move being checkmated", () => {
    expect(toPlayerView(mate(0), true).mate).toBe("losing");
    expect(toPlayerView(mate(0), false)).toEqual({ cp: CP_LIMIT, mate: "winning", mateMoves: 0 });
  });
});

describe("win chances and accuracy", () => {
  it("gives 50 % at equality and stays between 0 and 100", () => {
    expect(winPercent(0)).toBe(50);
    expect(winPercent(CP_LIMIT)).toBeGreaterThan(95);
    expect(winPercent(-CP_LIMIT)).toBeLessThan(5);
  });

  it("scores a move that loses nothing at 100 and a blunder far lower", () => {
    expect(moveAccuracy(30, 30)).toBeCloseTo(100, 0);
    expect(moveAccuracy(30, 60)).toBeCloseTo(100, 0);
    expect(moveAccuracy(0, -400)).toBeLessThan(30);
    expect(moveAccuracy(CP_LIMIT, -CP_LIMIT)).toBeGreaterThanOrEqual(0);
  });
});

describe("move quality", () => {
  it("grades by centipawns lost", () => {
    expect(classifyMove(20, 0)).toBe("good");
    expect(classifyMove(20, -40)).toBe("inaccuracy");
    expect(classifyMove(20, -100)).toBe("mistake");
    expect(classifyMove(20, -200)).toBe("blunder");
  });

  it("does not call a blunder a loss that leaves the game decided", () => {
    expect(classifyMove(CP_LIMIT, 780)).not.toBe("blunder");
    expect(classifyMove(-750, -CP_LIMIT)).not.toBe("blunder");
  });
});

describe("puzzle-worthy moves", () => {
  it("keeps a two-pawn blunder", () => {
    expect(puzzleKind(toPlayerView(cp(30), true), toPlayerView(cp(250), false))).toBe("blunder");
  });

  it("ignores small losses", () => {
    expect(puzzleKind(toPlayerView(cp(30), true), toPlayerView(cp(60), false))).toBeNull();
  });

  it("flags a mate allowed", () => {
    expect(puzzleKind(toPlayerView(cp(-20), true), toPlayerView(mate(1), false))).toBe("allowedMate");
  });

  it("flags a short mate missed even when the position stays winning", () => {
    expect(puzzleKind(toPlayerView(mate(2), true), toPlayerView(cp(-900), false))).toBe("missedMate");
  });

  it("does not flag a missed mate when the move still mates, or when the mate was long", () => {
    expect(puzzleKind(toPlayerView(mate(2), true), toPlayerView(mate(-3), false))).toBeNull();
    expect(puzzleKind(toPlayerView(mate(9), true), toPlayerView(cp(-950), false))).toBeNull();
  });

  it("skips positions that were already lost", () => {
    expect(puzzleKind(toPlayerView(cp(-600), true), toPlayerView(mate(2), false))).toBeNull();
  });
});
