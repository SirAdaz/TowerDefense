import { describe, expect, it } from "vitest";
import { MAX_HIT_MARKS, STEP_SECONDS } from "./balance.ts";
import { damageEnemy, HIT_MARK_MIN_DAMAGE, HIT_MARK_SECONDS, updateEffects } from "./combat.ts";
import { spawnEnemy } from "./enemies.ts";
import { createGame } from "./state.ts";
import type { Enemy, GameState } from "./types.ts";

function placeBrute(state: GameState): Enemy {
  const enemy = spawnEnemy(state, "brute", 200, 300);
  if (enemy === null) {
    throw new Error("Enemy pool is full");
  }
  return enemy;
}

function activeMarks(state: GameState): number {
  return state.hitMarks.filter((mark) => mark.isActive).length;
}

describe("hit marks", () => {
  it("shows the damage of a hit above the enemy, then fades", () => {
    const state = createGame(1);
    const brute = placeBrute(state);
    damageEnemy(state, brute, 12);
    const mark = state.hitMarks.find((candidate) => candidate.isActive);
    expect(mark).toMatchObject({ amount: 12, x: brute.x, y: brute.y - brute.radius, isKill: false });
    for (let elapsed = 0; elapsed < HIT_MARK_SECONDS + STEP_SECONDS; elapsed += STEP_SECONDS) {
      updateEffects(state, STEP_SECONDS);
    }
    expect(activeMarks(state)).toBe(0);
  });

  it("marks the killing blow", () => {
    const state = createGame(1);
    const brute = placeBrute(state);
    damageEnemy(state, brute, 999);
    expect(state.hitMarks.some((mark) => mark.isActive && mark.isKill)).toBe(true);
  });

  it("ignores the halo's per-step trickle of damage", () => {
    const state = createGame(1);
    damageEnemy(state, placeBrute(state), HIT_MARK_MIN_DAMAGE / 2);
    expect(activeMarks(state)).toBe(0);
  });

  it("reuses the oldest mark when the pool is full, without creating any", () => {
    const state = createGame(1);
    const brute = placeBrute(state);
    brute.hp = 1e9;
    const firstMark = state.hitMarks[0];
    for (let hit = 0; hit <= MAX_HIT_MARKS; hit++) {
      damageEnemy(state, brute, 10 + hit);
    }
    expect(state.hitMarks).toHaveLength(MAX_HIT_MARKS);
    expect(state.hitMarks[0]).toBe(firstMark);
    expect(state.hitMarks[0]?.amount).toBe(10 + MAX_HIT_MARKS);
    expect(activeMarks(state)).toBe(MAX_HIT_MARKS);
  });
});
