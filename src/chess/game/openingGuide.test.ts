import { describe, expect, it } from "vitest";
import { BARE_PGN, MATED_PGN } from "../../../tests/chessFixtures.ts";
import { ecoUrlPlies, MAX_OPENING_PLIES, openingLine } from "./openingGuide.ts";

describe("ecoUrlPlies", () => {
  it("lit le dernier coup de la variante dans l'adresse", () => {
    expect(ecoUrlPlies("https://www.chess.com/openings/Sicilian-Defense-Open-2...Nc6")).toBe(4);
    expect(ecoUrlPlies("https://www.chess.com/openings/Italian-Game-3...Bc5-4.c3")).toBe(7);
    expect(ecoUrlPlies("https://www.chess.com/openings/Ruy-Lopez-Opening-Morphy-Defense-12.h3")).toBe(MAX_OPENING_PLIES);
  });

  it("ne devine rien sans coup dans l'adresse", () => {
    expect(ecoUrlPlies("https://www.chess.com/openings/Sicilian-Defense")).toBeNull();
    expect(ecoUrlPlies(null)).toBeNull();
  });
});

describe("openingLine", () => {
  it("prend les coups de la partie, coupés à la variante, et l'idée de la famille", () => {
    const line = openingLine("Kings Pawn Opening", MATED_PGN);
    expect(line?.sanMoves).toEqual(["e4", "e5", "Qh5", "Nc6"]);
    expect(line?.idea).toContain("pion e");
    expect(line?.fen.startsWith("r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/")).toBe(true);
  });

  it("donne les coups de base sans partie, et reconnaît les noms à tiret", () => {
    expect(openingLine("Giuoco Piano Game", null)?.sanMoves).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]);
    expect(openingLine("Caro-Kann Defense", null)?.idea).toContain("c6");
  });

  it("montre les coups seuls pour une ouverture inconnue", () => {
    const line = openingLine("Ouverture inconnue", BARE_PGN);
    expect(line?.idea).toBeNull();
    expect(line?.sanMoves).toEqual(["d4", "d5", "c4", "e6"]);
    expect(openingLine("Ouverture inconnue", null)).toBeNull();
  });
});
