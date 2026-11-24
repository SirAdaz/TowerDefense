import { describe, expect, it } from "vitest";
import { playBot, type BotProfile } from "./bot.ts";

const IDLE: BotProfile = { maxTowers: 0, shouldUpgrade: false, shouldRush: false };
const BEGINNER: BotProfile = { maxTowers: 3, shouldUpgrade: false, shouldRush: false };
const BUILDER_ONLY: BotProfile = { maxTowers: 12, shouldUpgrade: false, shouldRush: false };
const CASUAL: BotProfile = { maxTowers: 4, shouldUpgrade: true, shouldRush: false };
const REGULAR: BotProfile = { maxTowers: 8, shouldUpgrade: true, shouldRush: false };
const RUSHER: BotProfile = { maxTowers: 8, shouldUpgrade: true, shouldRush: true };
const EXPERT: BotProfile = { maxTowers: 30, shouldUpgrade: true, shouldRush: false };

describe("difficulty curve (SPECS, section Équilibrage)", () => {
  it("if nothing is built, the game is lost at wave 3", () => {
    expect(playBot(IDLE)).toMatchObject({ waveReached: 3, isDefeated: true });
  });

  it("if only the 3 starting towers are placed, waves 1 and 2 cost no life", () => {
    const result = playBot(BEGINNER);
    expect(result.firstLossWave).toBeGreaterThanOrEqual(3);
    expect(result.waveReached).toBeGreaterThanOrEqual(5);
  });

  it("if the player only builds without upgrading, the first 9 waves cost no life", () => {
    expect(playBot(BUILDER_ONLY).firstLossWave).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ["casual", CASUAL],
    ["regular", REGULAR],
    ["rusher", RUSHER],
    ["expert", EXPERT],
  ])("if the %s player builds and upgrades, no life is lost before wave 15", (_label, profile) => {
    expect(playBot(profile).firstLossWave).toBeGreaterThanOrEqual(15);
  });

  it.each([
    ["casual", CASUAL],
    ["regular", REGULAR],
    ["rusher", RUSHER],
    ["expert", EXPERT],
  ])("if the %s player builds and upgrades, the game ends between waves 18 and 30", (_label, profile) => {
    const result = playBot(profile);
    expect(result.isDefeated).toBe(true);
    expect(result.waveReached).toBeGreaterThanOrEqual(18);
    expect(result.waveReached).toBeLessThanOrEqual(30);
  });

  it("if the player invests more, the game lasts longer", () => {
    expect(playBot(EXPERT).waveReached).toBeGreaterThan(playBot(CASUAL).waveReached);
    expect(playBot(CASUAL).waveReached).toBeGreaterThan(playBot(BUILDER_ONLY).waveReached);
  });
});
