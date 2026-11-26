import { describe, expect, it } from "vitest";
import { analysedGame, cp, moveReview } from "../../../tests/chessFixtures.ts";
import { firstDeviation, isEquivalentMove, openingDrillId, positionKey, selectOpeningSession, selectRepertoire } from "./repertoire.ts";
import type { AnalysedGame, MoveQuality, OpeningDrill } from "./types.ts";

/** Partie italienne inventée : le joueur (blancs) joue 4. Cg5, le moteur préférait 4. d3. */
const ITALIAN_PGN = '[Event "?"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 *\n';
/** Même position atteinte, autre écart : 4. Nc3. */
const ITALIAN_NC3_PGN = '[Event "?"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Nc3 Nxe4 5. Nxe4 d5 *\n';
/** Le joueur (noirs) contre 1. d4 : 1...f6 au lieu de 1...d5. */
const QUEENS_PAWN_PGN = '[Event "?"]\n[Result "*"]\n\n1. d4 f6 2. c4 e5 3. d5 c6 *\n';

const ITALIAN_FEN_BEFORE_MOVE_4 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

function bestMovesWith(ply: number, uci: string): string[] {
  return Array.from({ length: 12 }, (_, index) => (index === ply ? uci : "e2e4"));
}

interface GameSpec {
  readonly id: string;
  readonly pgn?: string;
  readonly deviationPly: number;
  readonly san: string;
  readonly bestUci?: string;
  readonly quality?: MoveQuality;
  readonly endTime?: number;
}

function italianGame(spec: GameSpec, overrides: Partial<AnalysedGame> = {}): AnalysedGame {
  const moves = [0, 2, 4, spec.deviationPly].map((ply) =>
    moveReview({ ply, san: ply === spec.deviationPly ? spec.san : "e4", quality: ply === spec.deviationPly ? (spec.quality ?? "inaccuracy") : "good", cpBefore: 40 }),
  );
  return analysedGame({
    id: spec.id,
    url: `https://www.chess.com/game/live/${spec.id}`,
    endTime: spec.endTime ?? 1_700_000_000,
    moves,
    timeline: { pgn: spec.pgn ?? ITALIAN_PGN, scores: [cp(20)], bestMoves: bestMovesWith(spec.deviationPly, spec.bestUci ?? "d2d3") },
    ...overrides,
  });
}

describe("firstDeviation", () => {
  it("prend le premier coup imprécis du joueur avant le 13e coup", () => {
    expect(firstDeviation(italianGame({ id: "a", deviationPly: 6, san: "Ng5" }))?.ply).toBe(6);
  });

  it("ignore ce qui vient après l'ouverture", () => {
    expect(firstDeviation(italianGame({ id: "a", deviationPly: 24, san: "Ng5" }))).toBeNull();
  });
});

describe("selectRepertoire", () => {
  it("regroupe les parties qui sortent de la route au même endroit en un seul exercice", () => {
    const games = [
      italianGame({ id: "a", deviationPly: 6, san: "Ng5", endTime: 1_700_000_000 }),
      italianGame({ id: "b", pgn: ITALIAN_NC3_PGN, deviationPly: 6, san: "Nc3", endTime: 1_700_000_500 }),
    ];
    const selection = selectRepertoire(games, []);
    expect(selection.drills).toHaveLength(1);
    const [drill] = selection.drills;
    expect(drill).toMatchObject({
      id: openingDrillId(ITALIAN_FEN_BEFORE_MOVE_4),
      openingName: "Italian Game",
      playerColor: "white",
      moveNumber: 4,
      bestUci: "d2d3",
      occurrences: 2,
      playedSans: ["Ng5", "Nc3"],
      playedUcis: ["f3g5", "b1c3"],
      gameUrl: "https://www.chess.com/game/live/b",
      previousMoveUci: "g8f6",
    });
    expect(selection.routes).toEqual([{ openingName: "Italian Game", playerColor: "white", gameCount: 2, drills: [drill] }]);
  });

  it("sépare les couleurs, et liste aussi les ouvertures sans sortie de route", () => {
    const black = (id: string) =>
      italianGame(
        { id, pgn: QUEENS_PAWN_PGN, deviationPly: 1, san: "f6", bestUci: "d7d5", quality: "mistake" },
        { playerColor: "black", openingName: "Queens Pawn Opening" },
      );
    const clean = (id: string) => italianGame({ id, deviationPly: 6, san: "d3", quality: "good" });
    const selection = selectRepertoire([black("c1"), black("c2"), clean("d1"), clean("d2")], []);
    expect(selection.routes.map((route) => [route.openingName, route.playerColor, route.drills.length])).toEqual([
      ["Italian Game", "white", 0],
      ["Queens Pawn Opening", "black", 1],
    ]);
    expect(selection.drills[0]?.moveNumber).toBe(1);
  });

  it("met de côté les parties sans PGN gardé, et ignore l'écart déjà joué par le moteur", () => {
    const withoutTimeline = analysedGame({ id: "e", moves: italianGame({ id: "e", deviationPly: 6, san: "Ng5" }).moves });
    const sameAsEngine = italianGame({ id: "f", deviationPly: 6, san: "Ng5", bestUci: "f3g5" });
    const selection = selectRepertoire([withoutTimeline, sameAsEngine], []);
    expect(selection.gamesToPrepare.map((game) => game.id)).toEqual(["e"]);
    expect(selection.drills).toEqual([]);
  });

  it("écarte une ouverture jouée une seule fois avec cette couleur", () => {
    expect(selectRepertoire([italianGame({ id: "a", deviationPly: 6, san: "Ng5" })], []).routes).toEqual([]);
  });

  it("écarte les ouvertures inconnues et les parties sans coup évalué", () => {
    const unknown = italianGame({ id: "g", deviationPly: 6, san: "Ng5" }, { openingName: "Undefined" });
    const empty = italianGame({ id: "h", deviationPly: 6, san: "Ng5" }, { moves: [] });
    expect(selectRepertoire([unknown, empty], []).routes).toEqual([]);
  });

  it("reprend l'état de révision gardé", () => {
    const review = { step: 2, dueAt: 5, attempts: 3, successes: 2 };
    const id = openingDrillId(ITALIAN_FEN_BEFORE_MOVE_4);
    const games = [italianGame({ id: "a", deviationPly: 6, san: "Ng5" }), italianGame({ id: "b", deviationPly: 6, san: "Ng5" })];
    const selection = selectRepertoire(games, [{ id, username: "joueur-test", review }]);
    expect(selection.drills[0]?.review).toEqual(review);
  });
});

describe("positionKey", () => {
  it("oublie les compteurs de coups", () => {
    expect(positionKey(ITALIAN_FEN_BEFORE_MOVE_4)).toBe("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -");
  });
});

describe("isEquivalentMove", () => {
  it("accepte un coup qui ne perd presque rien, refuse une imprécision", () => {
    expect(isEquivalentMove(40, 10)).toBe(true);
    expect(isEquivalentMove(40, -30)).toBe(false);
  });
});

function drillFor(id: string, openingName: string, review: Partial<OpeningDrill["review"]> = {}): OpeningDrill {
  const games = [italianGame({ id: "a", deviationPly: 6, san: "Ng5" }), italianGame({ id: "b", deviationPly: 6, san: "Ng5" })];
  const base = selectRepertoire(games, []).drills[0];
  if (base === undefined) {
    throw new Error("exercice attendu");
  }
  return { ...base, id, openingName, review: { ...base.review, ...review } };
}

describe("selectOpeningSession", () => {
  const NOW = 1_800_000_000_000;
  const due = drillFor("due", "Italian Game", { step: 0, dueAt: NOW - 1 });
  const later = drillFor("later", "Italian Game", { step: 1, dueAt: NOW + 10 });
  const other = drillFor("other", "Scotch Game");

  it("sans ouverture choisie, garde la révision espacée", () => {
    expect(selectOpeningSession([later, due, other], NOW, null).map((drill) => drill.id)).toEqual(["due", "other"]);
  });

  it("sur une ouverture, ses exercices dus puis les autres", () => {
    const focus = { openingName: "Italian Game", playerColor: "white" } as const;
    expect(selectOpeningSession([later, other, due], NOW, focus).map((drill) => drill.id)).toEqual(["due", "later"]);
  });
});
