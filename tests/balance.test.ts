import { describe, expect, it } from "vitest";
import { playGame } from "./bot.ts";

// Règles de la courbe de difficulté (docs/product/SPECS.md, dernière section), mesurées avec le joueur automatique.
describe("difficulty curve", () => {
  it("is easy at first: a normal player loses no life before wave 10", () => {
    const result = playGame({ maxTowers: 6, canUpgrade: true, maxWave: 40 });
    const livesLostBeforeWave10 = result.livesLostByWave.slice(0, 10).reduce((sum, lost) => sum + (lost ?? 0), 0);
    expect(livesLostBeforeWave10).toBe(0);
  });

  it("is felt between waves 15 and 25: a good player loses there", () => {
    for (const maxTowers of [6, 12, 30]) {
      const { waveReached } = playGame({ maxTowers, canUpgrade: true, maxWave: 40 });
      expect(waveReached).toBeGreaterThanOrEqual(15);
      expect(waveReached).toBeLessThanOrEqual(25);
    }
  });

  it("punishes a player who never upgrades", () => {
    expect(playGame({ maxTowers: 2, canUpgrade: false, maxWave: 40 }).waveReached).toBeLessThan(8);
    expect(playGame({ maxTowers: 12, canUpgrade: false, maxWave: 40 }).waveReached).toBeLessThan(18);
  });
});
