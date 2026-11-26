import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { bestCapture, exchangeGain } from "./exchange.ts";

function gainOf(fen: string, san: string): number {
  const chess = new Chess(fen);
  const move = new Chess(fen).move(san);
  return exchangeGain(chess, move);
}

describe("exchangeGain", () => {
  it("compte toute la pièce prise quand personne ne reprend", () => {
    expect(gainOf("4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1", "Qxd5")).toBe(3);
  });

  it("déduit la pièce qui prend quand l'adversaire reprend", () => {
    expect(gainOf("4k3/4p3/3n4/8/8/8/8/3QK3 w - - 0 1", "Qxd6")).toBe(-6);
    expect(gainOf("4k3/8/3n4/4P3/8/8/8/4K3 w - - 0 1", "exd6")).toBe(3);
  });

  it("voit une pièce mal défendue : prise par moins fort, elle rapporte même défendue", () => {
    expect(gainOf("4k3/3r4/8/2N5/8/8/8/4K3 w - - 0 1", "Nxd7")).toBe(2);
  });

  it("ne fait pas reprendre une pièce clouée", () => {
    const pinned = "3k4/8/3p4/4n3/8/8/4R3/3RK3 w - - 0 1";
    const free = "3k4/8/3p4/4n3/8/8/4R3/4K3 w - - 0 1";
    expect(gainOf(pinned, "Rxe5")).toBe(3);
    expect(gainOf(free, "Rxe5")).toBe(-2);
  });

  it("s'arrête quand reprendre coûterait plus que ça ne rapporte", () => {
    // Le pion prend le cavalier défendu par la dame : la dame ne reprend pas si une tour veille.
    expect(gainOf("3qk3/8/3n4/4P3/8/8/8/3RK3 w - - 0 1", "exd6")).toBe(3);
  });

  it("compte la pièce obtenue par une promotion qui prend", () => {
    expect(gainOf("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "axb8=Q+")).toBe(5);
  });
});

describe("bestCapture", () => {
  it("garde la prise qui gagne le plus", () => {
    const best = bestCapture(new Chess("4k3/8/3n4/4P3/8/1r6/8/1R2K3 w - - 0 1"));
    expect(best?.move.san).toBe("Rxb3");
    expect(best?.gain).toBe(5);
  });

  it("répond `null` sans prise gagnante", () => {
    expect(bestCapture(new Chess("4k3/4p3/3n4/8/8/8/8/3QK3 w - - 0 1"))).toBeNull();
    expect(bestCapture(new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toBeNull();
  });
});
