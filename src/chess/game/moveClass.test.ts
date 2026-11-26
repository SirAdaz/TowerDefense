import { describe, expect, it } from "vitest";
import { classifyFacts, isSacrifice } from "./moveClass.ts";
import type { MoveFacts } from "./moveClass.ts";

function facts(overrides: Partial<MoveFacts> = {}): MoveFacts {
  return { loss: 0, isBest: false, isSacrifice: false, opponentLoss: 0, winBefore: 50, winAfter: 50, ...overrides };
}

describe("classifyFacts", () => {
  it("classe par chances de gain perdues : 2, 5, 10 et 20 points", () => {
    expect(classifyFacts(facts({ isBest: true }))).toBe("best");
    expect(classifyFacts(facts({ loss: 1.9 }))).toBe("excellent");
    expect(classifyFacts(facts({ loss: 2 }))).toBe("good");
    expect(classifyFacts(facts({ loss: 5 }))).toBe("inaccuracy");
    expect(classifyFacts(facts({ loss: 10 }))).toBe("mistake");
    expect(classifyFacts(facts({ loss: 19.9 }))).toBe("mistake");
    expect(classifyFacts(facts({ loss: 20 }))).toBe("blunder");
  });

  it("garde « brillant » aux sacrifices justes dans une partie encore ouverte", () => {
    expect(classifyFacts(facts({ isBest: true, isSacrifice: true, winBefore: 60, winAfter: 62 }))).toBe("brilliant");
    expect(classifyFacts(facts({ isSacrifice: true, loss: 1, winBefore: 55, winAfter: 54 }))).toBe("brilliant");
    // Déjà gagné, perdant après, ou sacrifice qui coûte : pas brillant.
    expect(classifyFacts(facts({ isBest: true, isSacrifice: true, winBefore: 95, winAfter: 96 }))).toBe("best");
    expect(classifyFacts(facts({ isBest: true, isSacrifice: true, winBefore: 40, winAfter: 40 }))).toBe("best");
    expect(classifyFacts(facts({ isSacrifice: true, loss: 6, winBefore: 70, winAfter: 64 }))).toBe("inaccuracy");
  });

  it("repère l'occasion manquée après une faute adverse", () => {
    expect(classifyFacts(facts({ opponentLoss: 25, loss: 15, winBefore: 75, winAfter: 60 }))).toBe("miss");
    expect(classifyFacts(facts({ opponentLoss: 25, loss: 30, winBefore: 75, winAfter: 45 }))).toBe("miss");
    // L'adversaire n'avait rien donné, ou le coup fait perdre la partie : erreur ou gaffe.
    expect(classifyFacts(facts({ opponentLoss: 5, loss: 15, winBefore: 75, winAfter: 60 }))).toBe("mistake");
    expect(classifyFacts(facts({ opponentLoss: 25, loss: 50, winBefore: 75, winAfter: 25 }))).toBe("blunder");
  });
});

describe("isSacrifice", () => {
  it("voit une pièce laissée en prise contre un pion", () => {
    expect(isSacrifice("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1", "d1d4")).toBe(true);
  });

  it("ne compte ni les cases sûres, ni les échanges, ni les pions, ni le roi qui ne peut pas prendre", () => {
    expect(isSacrifice("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1", "d1d3")).toBe(false);
    expect(isSacrifice("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "h5f7")).toBe(false);
    expect(isSacrifice("4k3/8/8/4p3/8/8/3P4/3QK3 w - - 0 1", "d2d4")).toBe(false);
    expect(isSacrifice("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", "d1d8")).toBe(false);
  });

  it("voit une pièce défendue mais attaquée par moins qu'elle", () => {
    expect(isSacrifice("4k3/8/8/2p5/8/8/8/1R2K1R1 w - - 0 1", "b1b4")).toBe(true);
    expect(isSacrifice("4k3/8/8/2n5/8/8/4P3/1B2K3 w - - 0 1", "b1d3")).toBe(false);
  });

  it("refuse un coup illisible ou illégal", () => {
    expect(isSacrifice("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1", "zz")).toBe(false);
    expect(isSacrifice("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1", "d1h8")).toBe(false);
    expect(isSacrifice("4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1", "a1a2")).toBe(false);
  });
});
