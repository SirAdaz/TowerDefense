import { describe, expect, it } from "vitest";
import { detectBlunderTheme } from "./blunderThemes.ts";

const MIN_GAIN = 2;

describe("detectBlunderTheme", () => {
  it("voit la dame posée là où un pion la prend : pièce laissée en prise", () => {
    const fen = "rnbqk2r/ppp2ppp/3bp3/3p4/3P1B2/4PQ2/PPP2PPP/RN2KBNR w KQkq - 2 6";
    expect(detectBlunderTheme(fen, "Qe4", 0, MIN_GAIN)).toBe("hungPiece");
  });

  it("voit la pièce déjà attaquée et laissée là : menace ignorée", () => {
    const fen = "rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
    expect(detectBlunderTheme(fen, "d6", 0, MIN_GAIN)).toBe("ignoredThreat");
  });

  it("voit le mat laissé au coup suivant", () => {
    const fen = "r1bqkbnr/1ppp1pp1/p1n4p/4p2Q/2B1P3/2NP4/PPP2PPP/R1B1K1NR b KQkq - 1 5";
    expect(detectBlunderTheme(fen, "b6", 0, MIN_GAIN)).toBe("allowedMate");
  });

  it("ne compte pas un échange égal comme une pièce perdue", () => {
    // Le fou prend la tour, la tour reprend le fou : les noirs gagnent la qualité.
    expect(detectBlunderTheme("6k1/6b1/5R2/8/8/8/5R2/6K1 b - - 0 1", "Bxf6", 0, MIN_GAIN)).toBeNull();
  });

  it("ne dit rien quand la meilleure suite perd presque autant", () => {
    const fen = "rnbqk2r/ppp2ppp/3bp3/3p4/3P1B2/4PQ2/PPP2PPP/RN2KBNR w KQkq - 2 6";
    expect(detectBlunderTheme(fen, "Qe4", 8, MIN_GAIN)).toBeNull();
  });

  it("ne dit rien pour un pion seul, ni pour un coup illisible", () => {
    expect(detectBlunderTheme("4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1", "e4", 0, MIN_GAIN)).toBeNull();
    expect(detectBlunderTheme("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", "Zz9", 0, MIN_GAIN)).toBeNull();
  });
});
