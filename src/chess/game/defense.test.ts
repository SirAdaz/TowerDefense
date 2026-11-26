import { describe, expect, it } from "vitest";
import { IGNORED_MATE_PGN, IGNORED_PIECE_PGN, QUEEN_DROP_PGN, TEST_USER, analysedGame, moveReview } from "../../../tests/chessFixtures.ts";
import { defenseId, selectDefenseDrills } from "./defense.ts";
import { parseGame } from "./pgn.ts";
import type { AnalysedGame } from "./types.ts";

/** Meilleurs coups du moteur, demi-coup par demi-coup ; seul celui d'après la gaffe compte ici. */
function bestMoves(length: number, overrides: Record<number, string>): string[] {
  return Array.from({ length }, (_, index) => overrides[index] ?? "");
}

function gameWith(pgn: string, gaffe: { ply: number; san: string; cpBefore: number }, best: Record<number, string>): AnalysedGame {
  const plyCount = parseGame(pgn)?.moves.length ?? 0;
  return analysedGame({
    id: `game-${gaffe.ply}`,
    playerColor: gaffe.ply % 2 === 0 ? "white" : "black",
    moves: [
      moveReview({ ply: gaffe.ply - 2, san: "a3", quality: "good" }),
      moveReview({ ply: gaffe.ply, san: gaffe.san, cpBefore: gaffe.cpBefore, cpAfter: -1000, quality: "blunder" }),
    ],
    timeline: { pgn, scores: [], bestMoves: bestMoves(plyCount, best) },
  });
}

describe("selectDefenseDrills", () => {
  it("garde la gaffe qui a ignoré un mat, avec la menace et le meilleur coup", () => {
    const game = gameWith(IGNORED_MATE_PGN, { ply: 9, san: "b6", cpBefore: -40 }, { 9: "d8f6", 10: "h5f7" });
    const { drills, gamesToPrepare } = selectDefenseDrills([game], []);
    expect(gamesToPrepare).toEqual([]);
    expect(drills).toHaveLength(1);
    expect(drills[0]).toMatchObject({
      id: defenseId(game.id, 9),
      username: TEST_USER,
      playerColor: "black",
      cpBefore: -40,
      playedSan: "b6",
      playedUci: "b7b6",
      bestUci: "d8f6",
      previousMoveUci: "d1h5",
      threat: { kind: "mate", from: "h5", to: "f7" },
      review: { step: -1 },
    });
  });

  it("garde une pièce laissée en prise, reprend l'état de révision gardé", () => {
    const game = gameWith(IGNORED_PIECE_PGN, { ply: 3, san: "d6", cpBefore: -30 }, { 4: "e5f6" });
    const review = { step: 1, dueAt: 7, attempts: 2, successes: 1 };
    const { drills } = selectDefenseDrills([game], [{ id: defenseId(game.id, 3), username: TEST_USER, review }]);
    expect(drills[0]?.threat).toMatchObject({ kind: "capture", from: "e5", to: "f6" });
    expect(drills[0]?.review).toEqual(review);
  });

  it("écarte une gaffe sans menace d'avant, ou sans coup du moteur", () => {
    const noThreat = gameWith(QUEEN_DROP_PGN, { ply: 10, san: "Qe4", cpBefore: 300 }, { 11: "d5e4" });
    const noBest = gameWith(IGNORED_MATE_PGN, { ply: 9, san: "b6", cpBefore: -40 }, {});
    expect(selectDefenseDrills([noThreat, noBest], []).drills).toEqual([]);
  });

  it("signale les parties sans revue qui ont une gaffe, pas les autres", () => {
    const old = analysedGame({ id: "old", moves: [moveReview({ quality: "blunder" })] });
    const quiet = analysedGame({ id: "quiet" });
    const unreadable = analysedGame({ id: "broken", moves: [moveReview({ quality: "blunder" })], timeline: { pgn: "pas un pgn", scores: [], bestMoves: [] } });
    expect(selectDefenseDrills([old, quiet, unreadable], [])).toEqual({ drills: [], gamesToPrepare: [old] });
  });
});
