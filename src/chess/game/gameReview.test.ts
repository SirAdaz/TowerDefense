import { describe, expect, it } from "vitest";
import { BARE_PGN, cp, MATED_PGN, mate } from "../../../tests/chessFixtures.ts";
import { buildGameReview, spentSeconds } from "./gameReview.ts";
import { parseGame } from "./pgn.ts";
import type { GameTimeline } from "./types.ts";

/** 1. e4 e5 2. Dh5 Cc6 3. Fc4 Cf6 ?? 4. Dxf7# : égalité jusqu'à la gaffe noire. */
const MATED_TIMELINE: GameTimeline = {
  pgn: MATED_PGN,
  scores: [cp(30), cp(-30), cp(40), cp(-40), cp(50), cp(-50), mate(1), mate(0)],
  bestMoves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g7g6", "h5f7"],
};

describe("buildGameReview", () => {
  const review = buildGameReview(MATED_TIMELINE);

  it("donne un avis à chaque coup des deux camps", () => {
    expect(review?.plies.map((ply) => ply.moveClass)).toEqual([
      "best",
      "best",
      "excellent",
      "best",
      "best",
      "blunder",
      "best",
    ]);
    expect(review?.plies[5]?.color).toBe("black");
    expect(review?.plies[5]?.bestUci).toBe("g7g6");
  });

  it("résume chaque camp : précision et nombre de coups par avis", () => {
    expect(review?.black.counts.blunder).toBe(1);
    expect(review?.black.counts.best).toBe(2);
    expect(review?.white.counts.best).toBe(3);
    expect(review?.white.accuracy).toBeGreaterThan(review?.black.accuracy ?? 100);
    expect(review?.whiteName).toBe("adversaire-test");
    expect(review?.blackName).toBe("joueur-test");
  });

  it("trace la courbe des chances des blancs, jusqu'au mat", () => {
    expect(review?.whiteWinStart).toBeCloseTo(52.8, 0);
    expect(review?.plies[4]?.whiteWinAfter).toBeLessThan(55);
    expect(review?.plies[5]?.whiteWinAfter).toBeGreaterThan(95);
    expect(review?.plies[6]?.whiteWinAfter).toBeGreaterThan(95);
  });

  it("compte le temps passé, les coups longs et le zeitnot", () => {
    expect(review?.timeControl).toEqual({ baseSeconds: 180, incrementSeconds: 0 });
    expect(review?.plies.map((ply) => ply.spentSeconds)).toEqual([0, 0.9, 2, 3.8, 1, 166.9, 1]);
    expect(review?.plies[5]?.isLongThink).toBe(true);
    expect(review?.plies[5]?.isZeitnot).toBe(true);
    expect(review?.plies[3]?.isLongThink).toBe(false);
  });

  it("refuse un PGN illisible ou des évaluations qui ne collent pas aux coups", () => {
    expect(buildGameReview({ ...MATED_TIMELINE, pgn: "pas un pgn" })).toBeNull();
    expect(buildGameReview({ ...MATED_TIMELINE, scores: [cp(0)] })).toBeNull();
  });

  it("se passe de pendule et de noms", () => {
    const bare = buildGameReview({ pgn: BARE_PGN, scores: [cp(0), cp(0), cp(0), cp(0), cp(0)], bestMoves: [] });
    expect(bare?.plies.every((ply) => ply.spentSeconds === null && !ply.isZeitnot)).toBe(true);
    expect(bare?.timeControl).toBeNull();
    expect(bare?.whiteName).toBe("Blancs");
    expect(bare?.plies[0]?.moveClass).toBe("excellent");
  });
});

describe("spentSeconds", () => {
  it("ajoute l'incrément à partir du deuxième coup de chaque camp", () => {
    const moves = parseGame(MATED_PGN)?.moves ?? [];
    expect(spentSeconds(moves, 2, { baseSeconds: 180, incrementSeconds: 2 })).toBe(4);
    expect(spentSeconds(moves, 0, { baseSeconds: 180, incrementSeconds: 2 })).toBe(0);
    expect(spentSeconds(moves, 0, null)).toBeNull();
    expect(spentSeconds(moves, 99, null)).toBeNull();
  });
});
