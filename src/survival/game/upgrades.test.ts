import { describe, expect, it } from "vitest";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HEAL_CHOICE_HP,
  LEVEL_UP_HEAL,
  MAX_PASSIVE_LEVEL,
  MAX_WEAPON_LEVEL,
  PASSIVE_BONUS,
  PASSIVE_IDS,
  PLAYER,
  STEP_SECONDS,
  UNLOCKS,
  WEAPON_IDS,
} from "./balance.ts";
import { gainXp, hurtPlayer, movePlayer, recomputeStats, tickPlayer, xpForLevel } from "./player.ts";
import { nextIndex, nextRandom } from "./rng.ts";
import { createGame, takeFree } from "./state.ts";
import type { GameState } from "./types.ts";
import { availableChoices, chooseUpgrade, isInDraw, openLevelUp, rollChoices } from "./upgrades.ts";

const ALL_UNLOCKS = UNLOCKS.map((unlock) => unlock.id);

function maxEverything(state: GameState): void {
  for (const id of WEAPON_IDS) {
    state.weapons[id].level = MAX_WEAPON_LEVEL;
  }
  for (const id of PASSIVE_IDS) {
    state.passives[id] = MAX_PASSIVE_LEVEL;
  }
}

describe("rng", () => {
  it("gives the same sequence for the same seed, inside [0, 1)", () => {
    const first = { rngState: 123 };
    const second = { rngState: 123 };
    const values = Array.from({ length: 200 }, () => nextRandom(first));
    expect(Array.from({ length: 200 }, () => nextRandom(second))).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(190);
    expect(nextIndex(first, 4)).toBeLessThan(4);
  });
});

describe("the player", () => {
  it("starts in the middle with the spark only", () => {
    const state = createGame(1);
    expect(state.player).toMatchObject({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, hp: PLAYER.maxHp, level: 1 });
    expect(WEAPON_IDS.filter((id) => state.weapons[id].level > 0)).toEqual(["spark"]);
    expect(takeFree(state.enemies)).toBe(state.enemies[0]);
  });

  it("follows the target without teleporting and stops on it", () => {
    const state = createGame(1);
    const target = { targetX: state.player.x + 3, targetY: state.player.y };
    movePlayer(state, target, STEP_SECONDS);
    expect(state.player.x).toBe(ARENA_WIDTH / 2 + 3);
    movePlayer(state, { targetX: 5000, targetY: -5000 }, 100);
    expect(state.player.x).toBe(ARENA_WIDTH - PLAYER.radius);
    expect(state.player.y).toBe(PLAYER.radius);
  });

  it("levels up along a rising curve, heals a little each level, and queues one choice per level", () => {
    const state = createGame(1);
    state.player.hp = 50;
    expect(xpForLevel(1)).toBeLessThan(xpForLevel(2));
    expect(xpForLevel(10) - xpForLevel(9)).toBeGreaterThan(xpForLevel(2) - xpForLevel(1));
    gainXp(state, xpForLevel(1) + xpForLevel(2) + 1);
    expect(state.player.level).toBe(3);
    expect(state.player.xp).toBe(1);
    expect(state.pendingLevelUps).toBe(2);
    expect(state.player.hp).toBe(50 + 2 * LEVEL_UP_HEAL);
  });

  it("derives its stats from the passives", () => {
    const state = createGame(1, ALL_UNLOCKS);
    for (const id of PASSIVE_IDS) {
      state.passives[id] = 2;
    }
    recomputeStats(state);
    expect(state.stats.maxHp).toBe(PLAYER.maxHp + 2 * PASSIVE_BONUS.vigorHp);
    expect(state.stats.moveSpeed).toBeCloseTo(PLAYER.speed * 1.16);
    expect(state.stats.pickupRadius).toBeCloseTo(PLAYER.pickupRadius * 1.7);
    expect(state.stats.damageMultiplier).toBeCloseTo(1.24);
    expect(state.stats.cooldownMultiplier).toBeCloseTo(0.84);
    expect(state.stats.damageTakenMultiplier).toBeCloseTo(0.8);
    expect(state.stats.xpMultiplier).toBeCloseTo(1.24);
    state.player.hp = 10;
    hurtPlayer(state, 10);
    expect(state.player.hp).toBeCloseTo(2);
    tickPlayer(state, 2);
    expect(state.player.hp).toBeCloseTo(2 + 2 * 2 * PASSIVE_BONUS.regen);
    expect(state.player.hurtTimer).toBe(0);
  });
});

describe("the upgrade draw", () => {
  it("keeps locked weapons and passives out until they are unlocked", () => {
    expect(isInDraw([], "spark")).toBe(true);
    expect(isInDraw([], "storm")).toBe(false);
    expect(isInDraw(["storm"], "storm")).toBe(true);
    const base = availableChoices(createGame(1)).map((choice) => choice.id);
    expect(base).not.toContain("lance");
    expect(base).not.toContain("regen");
    const full = availableChoices(createGame(1, ALL_UNLOCKS)).map((choice) => choice.id);
    expect(full).toEqual([...WEAPON_IDS, ...PASSIVE_IDS]);
  });

  it("offers three different cards, with the level each one would reach", () => {
    const state = createGame(8);
    const choices = rollChoices(state);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
    const spark = availableChoices(state).find((choice) => choice.id === "spark");
    expect(spark?.level).toBe(2);
  });

  it("falls back on a heal when everything is maxed", () => {
    const state = createGame(1, ALL_UNLOCKS);
    maxEverything(state);
    expect(rollChoices(state)).toEqual([{ kind: "heal", id: "heal", level: 0 }]);
    state.passives.vigor = MAX_PASSIVE_LEVEL - 1;
    expect(rollChoices(state).map((choice) => choice.id)).toEqual(["vigor", "heal"]);
  });

  it("applies a weapon, a passive or a heal, then resumes the night", () => {
    const state = createGame(1);
    state.player.hp = 40;
    state.pendingLevelUps = 3;
    openLevelUp(state);
    state.choices = [{ kind: "weapon", id: "halo", level: 1 }];
    expect(chooseUpgrade(state, 0)).toBe(true);
    expect(state.weapons.halo.level).toBe(1);
    expect(state.phase).toBe("levelUp");
    state.choices = [{ kind: "passive", id: "vigor", level: 1 }];
    chooseUpgrade(state, 0);
    expect(state.stats.maxHp).toBe(PLAYER.maxHp + PASSIVE_BONUS.vigorHp);
    expect(state.player.hp).toBe(40 + PASSIVE_BONUS.vigorHp);
    state.choices = [{ kind: "heal", id: "heal", level: 0 }];
    chooseUpgrade(state, 0);
    expect(state.player.hp).toBe(40 + PASSIVE_BONUS.vigorHp + HEAL_CHOICE_HP);
    expect(state.phase).toBe("playing");
    expect(state.choices).toEqual([]);
  });

  it("never heals above the maximum and refuses a card that is not on the table", () => {
    const state = createGame(1);
    expect(chooseUpgrade(state, 0)).toBe(false);
    state.pendingLevelUps = 1;
    openLevelUp(state);
    expect(chooseUpgrade(state, 7)).toBe(false);
    state.choices = [{ kind: "heal", id: "heal", level: 0 }];
    chooseUpgrade(state, 0);
    expect(state.player.hp).toBe(PLAYER.maxHp);
  });
});
