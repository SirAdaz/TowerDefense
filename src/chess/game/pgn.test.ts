import { describe, expect, it } from "vitest";
import { BARE_PGN, MATED_PGN } from "../../../tests/chessFixtures.ts";
import { UNKNOWN_OPENING, openingFamily, parseClocks, parseGame, parseTimeControl, pgnHeader, phaseOf } from "./pgn.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("clocks", () => {
  it("reads one clock per half-move, in seconds", () => {
    expect(parseClocks(MATED_PGN)).toEqual([180, 179.1, 178, 175.3, 177, 8.4, 176]);
  });

  it("returns nothing without clock comments", () => {
    expect(parseClocks(BARE_PGN)).toEqual([]);
  });
});

describe("opening family", () => {
  it("cuts the address at the family name", () => {
    expect(openingFamily("https://www.chess.com/openings/Sicilian-Defense-Open-2...Nc6-3.d4")).toBe("Sicilian Defense");
    expect(openingFamily("https://www.chess.com/openings/Queens-Gambit-Declined-3.Nc3")).toBe("Queens Gambit");
    expect(openingFamily("https://www.chess.com/openings/Italian-Game")).toBe("Italian Game");
  });

  it("falls back to the first words when no family word is found", () => {
    expect(openingFamily("https://www.chess.com/openings/Ruy-Lopez-Morphy-Variation-4.Ba4")).toBe("Ruy Lopez Morphy");
  });

  it("copes with a missing or odd address", () => {
    expect(openingFamily(undefined)).toBe(UNKNOWN_OPENING);
    expect(openingFamily("https://www.chess.com/openings/")).toBe(UNKNOWN_OPENING);
    expect(openingFamily("nothing")).toBe(UNKNOWN_OPENING);
  });
});

describe("game phase", () => {
  it("is the opening for the first twelve moves", () => {
    expect(phaseOf(START_FEN, 0)).toBe("opening");
    expect(phaseOf(START_FEN, 23)).toBe("opening");
  });

  it("is the middlegame afterwards while pieces remain", () => {
    expect(phaseOf(START_FEN, 24)).toBe("middlegame");
  });

  it("is the endgame with six pieces or fewer, whatever the move number", () => {
    expect(phaseOf("4k3/pp3ppp/8/8/8/8/PP3PPP/R3K2R w - - 0 30", 58)).toBe("endgame");
    expect(phaseOf("", 5)).toBe("endgame");
  });
});

describe("parsing a game", () => {
  it("lists every half-move with its start position, colour and clock", () => {
    const parsed = parseGame(MATED_PGN);
    expect(parsed?.moves).toHaveLength(7);
    expect(parsed?.moves[0]).toEqual({ san: "e4", uci: "e2e4", fenBefore: START_FEN, color: "white", clockSeconds: 180 });
    expect(parsed?.moves[5]).toMatchObject({ san: "Nf6", uci: "g8f6", color: "black", clockSeconds: 8.4 });
    expect(parsed?.openingName).toBe("Kings Pawn Opening");
    expect(parsed?.eco).toBe("C20");
    expect(parsed?.finalFen.startsWith("r1bqkb1r/pppp1Qpp")).toBe(true);
  });

  it("leaves clocks empty when the PGN has none", () => {
    const parsed = parseGame(BARE_PGN);
    expect(parsed?.moves.map((move) => move.clockSeconds)).toEqual([null, null, null, null]);
    expect(parsed?.openingName).toBe(UNKNOWN_OPENING);
    expect(parsed?.eco).toBe("");
  });

  it("rejects an unreadable PGN", () => {
    expect(parseGame("1. e4 e5 2. Ke3 *")).toBeNull();
  });

  it("rejects a game that does not start from the initial position", () => {
    const fromPosition = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *\n';
    expect(parseGame(fromPosition)).toBeNull();
  });
});

describe("time control and headers", () => {
  it("lit la cadence et l'incrément", () => {
    expect(parseTimeControl('[TimeControl "180+2"]')).toEqual({ baseSeconds: 180, incrementSeconds: 2 });
    expect(parseTimeControl('[TimeControl "60"]')).toEqual({ baseSeconds: 60, incrementSeconds: 0 });
    expect(parseTimeControl('[TimeControl "1/259200"]')).toBeNull();
    expect(parseTimeControl("")).toBeNull();
  });

  it("lit un en-tête, ou rien", () => {
    expect(pgnHeader(MATED_PGN, "White")).toBe("adversaire-test");
    expect(pgnHeader(MATED_PGN, "Termination")).toBeNull();
  });
});
