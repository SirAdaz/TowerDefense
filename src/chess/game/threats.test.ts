import { describe, expect, it } from "vitest";
import { IGNORED_MATE_PGN, IGNORED_PIECE_PGN, QUEEN_DROP_PGN } from "../../../tests/chessFixtures.ts";
import { parseGame } from "./pgn.ts";
import { describeThreat, detectThreat, isGoodParry, isThreatSquare, passTurn } from "./threats.ts";

function fenBefore(pgn: string, ply: number): string {
  return parseGame(pgn)?.moves[ply]?.fenBefore ?? "";
}

describe("passTurn", () => {
  it("donne le trait à l'adversaire, sans prise en passant", () => {
    expect(passTurn("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2")).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2",
    );
  });

  it("refuse de passer quand le joueur est en échec", () => {
    expect(passTurn("rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3")).toBeNull();
  });
});

describe("detectThreat", () => {
  it("voit la menace de mat que la gaffe a ignorée", () => {
    expect(detectThreat(fenBefore(IGNORED_MATE_PGN, 9), "h5f7")).toEqual({
      kind: "mate",
      moveUci: "h5f7",
      from: "h5",
      to: "f7",
      san: "Qxf7#",
    });
  });

  it("voit la pièce attaquée par moins fort qu'elle", () => {
    expect(detectThreat(fenBefore(IGNORED_PIECE_PGN, 3), "e5f6")).toMatchObject({ kind: "capture", from: "e5", to: "f6" });
  });

  it("voit une pièce non défendue, même prise par plus fort qu'elle", () => {
    const hangingKnight = "4k3/8/8/3n4/8/8/8/3QK3 b - - 0 1";
    expect(detectThreat(hangingKnight, "d1d5")).toMatchObject({ kind: "capture", from: "d1", to: "d5" });
  });

  it("ignore un échange égal, une prise de moins que ce qui prend, et une pièce défendue", () => {
    // 6. De4 ?? : avant, les noirs n'avaient que Fxf4, repris par le pion e3.
    expect(detectThreat(fenBefore(QUEEN_DROP_PGN, 10), "d6f4")).toBeNull();
    const defendedPawn = "4k3/8/2p5/3p4/8/8/8/3QK3 b - - 0 1";
    expect(detectThreat(defendedPawn, "d1d5")).toBeNull();
  });

  it("ignore une menace créée par la gaffe elle-même", () => {
    // 6. De4 ?? dxe4 : avant le coup, le pion d5 ne pouvait rien prendre en e4.
    expect(detectThreat(fenBefore(QUEEN_DROP_PGN, 10), "d5e4")).toBeNull();
  });

  it("ignore un coup illisible et une position où passer est illégal", () => {
    expect(detectThreat(fenBefore(IGNORED_MATE_PGN, 9), "zz")).toBeNull();
    expect(detectThreat("rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3", "h4e1")).toBeNull();
  });
});

describe("réponses du joueur", () => {
  const threat = { kind: "capture", moveUci: "e5f6", from: "e5", to: "f6", san: "exf6" } as const;

  it("accepte la pièce qui menace et la pièce menacée, rien d'autre", () => {
    expect(isThreatSquare(threat, "e5")).toBe(true);
    expect(isThreatSquare(threat, "f6")).toBe(true);
    expect(isThreatSquare(threat, "e4")).toBe(false);
  });

  it("accepte une parade qui garde l'évaluation, refuse une erreur ou une gaffe", () => {
    expect(isGoodParry(50, 20)).toBe(true);
    expect(isGoodParry(100, 30)).toBe(true);
    expect(isGoodParry(100, -20)).toBe(false);
    expect(isGoodParry(-30, -350)).toBe(false);
  });
});

describe("describeThreat", () => {
  it("dit la prise menacée et le mat menacé en clair", () => {
    const pieceFen = fenBefore(IGNORED_PIECE_PGN, 3);
    const capture = detectThreat(pieceFen, "e5f6");
    expect(capture === null ? "" : describeThreat(pieceFen, capture)).toBe("Le pion en e5 peut prendre votre cavalier en f6 (exf6).");
    const mateFen = fenBefore(IGNORED_MATE_PGN, 9);
    const mate = detectThreat(mateFen, "h5f7");
    expect(mate === null ? "" : describeThreat(mateFen, mate)).toBe("La dame en h5 menace de mater en f7 (Dxf7#).");
  });

  it("reste lisible si la case est vide", () => {
    expect(describeThreat("4k3/8/8/8/8/8/8/4K3 w - - 0 1", { kind: "capture", moveUci: "a1a2", from: "a1", to: "a2", san: "Ra2" })).toBe(
      "La pièce en a1 peut prendre votre pièce en a2 (Ta2).",
    );
  });
});
