import { describe, expect, it } from "vitest";
import { RUN_SECONDS, UNLOCKS } from "../src/survival/game/balance.ts";
import { playSurvivalBot, type SurvivalBotProfile, type SurvivalBotResult } from "./survivalBot.ts";

const SEEDS = [1, 2, 3, 4, 5];
/** Une nuit entière se simule en moins d'une seconde, plusieurs sous la mesure de couverture. */
const TIMEOUT_MS = 120_000;
const IDLE: SurvivalBotProfile = { moves: "still", prefers: "first" };
const CASUAL: SurvivalBotProfile = { moves: "dodge", prefers: "passive" };
const SHARP: SurvivalBotProfile = { moves: "dodge", prefers: "weapon" };

const played = new Map<SurvivalBotProfile, SurvivalBotResult[]>();

/** Une nuit par graine, jouée une seule fois par profil pour toute la suite. */
function playAll(profile: SurvivalBotProfile, seeds: readonly number[] = SEEDS): SurvivalBotResult[] {
  const results = played.get(profile) ?? seeds.map((seed) => playSurvivalBot(seed, profile));
  played.set(profile, results);
  return results;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Courbe de difficulté de Nuit blanche, jouée par le joueur automatique sur plusieurs graines. */
describe("survival difficulty curve", { timeout: TIMEOUT_MS }, () => {
  it("is deterministic: same seed and profile, same night", () => {
    expect(playSurvivalBot(3, IDLE)).toEqual(playAll(IDLE)[2]);
    expect(playSurvivalBot(4, IDLE)).not.toEqual(playAll(IDLE)[2]);
  });

  it("kills a player who lets go of the mouse within two minutes", () => {
    for (const result of playAll(IDLE)) {
      expect(result.hasWon).toBe(false);
      expect(result.seconds).toBeLessThan(120);
    }
  });

  it("lets a careless build last a few minutes, not the whole night", () => {
    // Trois graines suffisent ici : ces nuits remplissent l'arène et sont les plus longues à simuler.
    const results = playAll(CASUAL, SEEDS.slice(0, 3));
    expect(median(results.map((result) => result.seconds))).toBeGreaterThan(150);
    expect(results.filter((result) => result.hasWon)).toHaveLength(0);
  });

  it("lets a careful player who builds weapons see the dawn most nights", () => {
    const results = playAll(SHARP);
    const wins = results.filter((result) => result.hasWon);
    expect(wins.length).toBeGreaterThanOrEqual(3);
    expect(median(results.map((result) => result.seconds))).toBeGreaterThanOrEqual(RUN_SECONDS - 90);
    for (const win of wins) {
      // Une vingtaine à une trentaine de choix sur la nuit : assez pour construire, sans tout obtenir.
      expect(win.level).toBeGreaterThanOrEqual(20);
      expect(win.level).toBeLessThanOrEqual(36);
    }
  });

  it("pays enough coins to unlock everything in a handful of nights, not in one", () => {
    const total = UNLOCKS.reduce((sum, unlock) => sum + unlock.cost, 0);
    const bestNight = Math.max(...playAll(SHARP).map((result) => result.coins));
    expect(bestNight).toBeLessThan(total / 2);
    expect(bestNight * 6).toBeGreaterThan(total);
  });
});
