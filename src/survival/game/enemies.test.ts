import { describe, expect, it } from "vitest";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS,
  CHARGE,
  ELITE,
  ENEMIES,
  MAX_ENEMIES,
  PLAYER,
  RUN_SECONDS,
  SPAWN,
  STEP_SECONDS,
} from "./balance.ts";
import { enemyHpScale, promoteToElite, rampMinutes, separateEnemies, spawnEnemy, updateEnemies } from "./enemies.ts";
import { findEnemiesNear, rebuildGrid } from "./spatial.ts";
import { pickKind, spawnRate, updateSpawns } from "./spawner.ts";
import { createGame } from "./state.ts";
import type { Enemy, EnemyKind, GameState } from "./types.ts";

function place(state: GameState, kind: EnemyKind, x: number, y: number): Enemy {
  const enemy = spawnEnemy(state, kind, x, y);
  if (enemy === null) {
    throw new Error("Enemy pool is full");
  }
  return enemy;
}

function advance(state: GameState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP_SECONDS) {
    updateEnemies(state, STEP_SECONDS);
  }
}

describe("spawnEnemy", () => {
  it("makes enemies tougher as the minutes pass, except the boss", () => {
    const state = createGame(1);
    state.time = 300;
    expect(place(state, "drifter", 0, 0).hp).toBeCloseTo(ENEMIES.drifter.hp * (1 + SPAWN.hpPerMinute * 5));
    expect(place(state, "boss", 0, 0).hp).toBe(ENEMIES.boss.hp);
    expect(enemyHpScale(0)).toBe(1);
    expect(state.enemyCount).toBe(2);
  });

  it("gives up when the pool is full", () => {
    const state = createGame(1);
    for (let index = 0; index < MAX_ENEMIES; index++) {
      place(state, "drifter", index, 0);
    }
    expect(spawnEnemy(state, "drifter", 0, 0)).toBeNull();
    expect(state.enemyCount).toBe(MAX_ENEMIES);
  });

  it("turns an enemy into a bigger, much tougher elite", () => {
    const state = createGame(1);
    const elite = place(state, "brute", 0, 0);
    promoteToElite(elite);
    expect(elite.isElite).toBe(true);
    expect(elite.hp).toBe(ENEMIES.brute.hp * ELITE.hpFactor);
    expect(elite.radius).toBe(ENEMIES.brute.radius * ELITE.radiusFactor);
  });
});

describe("updateEnemies", () => {
  it("walks enemies towards the player at their speed", () => {
    const state = createGame(1);
    const drifter = place(state, "drifter", state.player.x - 400, state.player.y);
    advance(state, 1);
    expect(drifter.x).toBeCloseTo(state.player.x - 400 + ENEMIES.drifter.speed, 0);
    expect(drifter.y).toBeCloseTo(state.player.y);
  });

  it("hurts the player on contact, then leaves a moment of invulnerability", () => {
    const state = createGame(1);
    place(state, "drifter", state.player.x + 5, state.player.y);
    updateEnemies(state, STEP_SECONDS);
    expect(state.player.hp).toBe(PLAYER.maxHp - ENEMIES.drifter.damage);
    expect(state.shakeTimer).toBeGreaterThan(0);
    updateEnemies(state, STEP_SECONDS);
    expect(state.player.hp).toBe(PLAYER.maxHp - ENEMIES.drifter.damage);
  });

  it("makes a charger stop, then rush in a straight line, then rest", () => {
    const state = createGame(1);
    const charger = place(state, "charger", state.player.x - 300, state.player.y);
    const advanceUntil = (stage: Enemy["stage"]): number => {
      let seconds = 0;
      while (charger.stage !== stage && seconds < 10) {
        updateEnemies(state, STEP_SECONDS);
        seconds += STEP_SECONDS;
      }
      return seconds;
    };
    advanceUntil("windup");
    const stoppedAt = charger.x;
    // Le joueur s'écarte pendant l'arrêt : la charge garde la direction prise au départ.
    state.player.y += 300;
    expect(advanceUntil("dash")).toBeCloseTo(CHARGE.windupSeconds, 1);
    // Immobile pendant tout l'arrêt : seul le premier pas de la ruée l'a déplacé.
    expect(charger.x).toBeCloseTo(stoppedAt + ENEMIES.charger.dashSpeed * STEP_SECONDS);
    expect(advanceUntil("chase")).toBeCloseTo(CHARGE.dashSeconds, 1);
    const rushed = charger.x - stoppedAt;
    expect(Math.abs(rushed - ENEMIES.charger.dashSpeed * CHARGE.dashSeconds)).toBeLessThan(15);
    expect(Math.abs(charger.y - (state.player.y - 300))).toBeLessThan(3);
  });

  it("does not charge from too far", () => {
    const state = createGame(1);
    const charger = place(state, "charger", state.player.x - CHARGE.range - 400, state.player.y);
    advance(state, CHARGE.restSeconds);
    expect(charger.stage).toBe("chase");
  });

  it("lets a pushed enemy slide back, then come again", () => {
    const state = createGame(1);
    const drifter = place(state, "drifter", state.player.x - 200, state.player.y);
    drifter.pushX = -400;
    advance(state, 0.2);
    expect(drifter.x).toBeLessThan(state.player.x - 200);
    advance(state, 3);
    expect(Math.abs(drifter.pushX)).toBeLessThan(1);
    expect(drifter.x).toBeGreaterThan(state.player.x - 200);
  });

  it("keeps a far-flung enemy near the arena", () => {
    const state = createGame(1);
    const drifter = place(state, "drifter", -5000, ARENA_HEIGHT + 5000);
    updateEnemies(state, STEP_SECONDS);
    expect(drifter.x).toBeGreaterThan(-200);
    expect(drifter.y).toBeLessThan(ARENA_HEIGHT + 200);
  });

  it("has the boss call a ring of swarmers at a fixed pace", () => {
    const state = createGame(1);
    place(state, "boss", 200, 200);
    advance(state, BOSS.summonEverySeconds + 0.05);
    expect(state.enemies.filter((enemy) => enemy.isActive && enemy.kind === "swarmer")).toHaveLength(BOSS.summonCount);
  });
});

describe("separateEnemies", () => {
  it("pushes overlapping enemies apart but leaves the boss and a rushing charger alone", () => {
    const state = createGame(1);
    const first = place(state, "drifter", 400, 400);
    const second = place(state, "drifter", 404, 400);
    const boss = place(state, "boss", 800, 400);
    const besideBoss = place(state, "drifter", 830, 400);
    const rushing = place(state, "charger", 1200, 400);
    rushing.stage = "dash";
    place(state, "drifter", 1203, 400);
    rebuildGrid(state);
    separateEnemies(state);
    expect(second.x - first.x).toBeGreaterThan(4);
    expect(boss.x).toBe(800);
    expect(besideBoss.x).toBeGreaterThan(830);
    expect(rushing.x).toBe(1200);
  });
});

describe("the spatial grid", () => {
  it("finds the enemies around a point, including those waiting outside the arena", () => {
    const state = createGame(1);
    place(state, "drifter", 100, 100);
    place(state, "drifter", -30, 110);
    place(state, "drifter", ARENA_WIDTH - 50, ARENA_HEIGHT - 50);
    rebuildGrid(state);
    expect(findEnemiesNear(state, 90, 90, 40)).toBe(2);
    expect(findEnemiesNear(state, ARENA_WIDTH, ARENA_HEIGHT, 10)).toBe(1);
    expect(findEnemiesNear(state, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 10)).toBe(0);
  });
});

describe("updateSpawns", () => {
  it("lets in more enemies per second as the night goes on", () => {
    expect(spawnRate(0)).toBe(SPAWN.baseRate);
    expect(spawnRate(300)).toBeCloseTo(SPAWN.baseRate + SPAWN.ratePerMinute * 5);
    expect(spawnRate(RUN_SECONDS + 300)).toBe(spawnRate(RUN_SECONDS));
  });

  it("ramps up gently during the first minutes, then follows the clock", () => {
    const gentleSeconds = SPAWN.gentleMinutes * 60;
    expect(rampMinutes(0)).toBe(0);
    expect(rampMinutes(gentleSeconds / 2)).toBeCloseTo(SPAWN.gentleMinutes / 4);
    expect(rampMinutes(gentleSeconds)).toBeCloseTo(SPAWN.gentleMinutes);
    expect(rampMinutes(gentleSeconds + 60)).toBeCloseTo(SPAWN.gentleMinutes + 1);
    expect(spawnRate(60)).toBeLessThan(SPAWN.baseRate + SPAWN.ratePerMinute);
    expect(enemyHpScale(60)).toBeLessThan(1 + SPAWN.hpPerMinute);
  });

  it("only sends drifters at first, then mixes in every kind", () => {
    const state = createGame(9);
    const early = new Set(Array.from({ length: 50 }, () => pickKind(state)));
    expect([...early]).toEqual(["drifter"]);
    state.time = 8 * 60;
    const late = new Set(Array.from({ length: 300 }, () => pickKind(state)));
    expect([...late].sort()).toEqual(["brute", "charger", "drifter", "swarmer"]);
  });

  it("spawns just outside the arena", () => {
    const state = createGame(4);
    for (let elapsed = 0; elapsed < 20; elapsed += STEP_SECONDS) {
      updateSpawns(state, STEP_SECONDS);
    }
    const active = state.enemies.filter((enemy) => enemy.isActive);
    expect(active.length).toBeGreaterThan(10);
    for (const enemy of active) {
      const isOutside = enemy.x < 0 || enemy.x > ARENA_WIDTH || enemy.y < 0 || enemy.y > ARENA_HEIGHT;
      expect(isOutside).toBe(true);
    }
  });

  it("sends an elite at a fixed pace, never during the boss fight", () => {
    const state = createGame(4);
    state.time = ELITE.firstAt;
    state.eliteTimer = STEP_SECONDS / 2;
    updateSpawns(state, STEP_SECONDS);
    expect(state.enemies.filter((enemy) => enemy.isActive && enemy.isElite)).toHaveLength(1);
    expect(state.eliteTimer).toBeCloseTo(ELITE.everySeconds - STEP_SECONDS / 2);
    state.isBossSpawned = true;
    state.eliteTimer = STEP_SECONDS / 2;
    updateSpawns(state, STEP_SECONDS);
    expect(state.enemies.filter((enemy) => enemy.isActive && enemy.isElite)).toHaveLength(1);
  });

  it("stops filling the arena before the pool is full", () => {
    const state = createGame(4);
    state.time = RUN_SECONDS - 1;
    for (let elapsed = 0; elapsed < 200; elapsed += STEP_SECONDS) {
      updateSpawns(state, STEP_SECONDS);
      state.time = RUN_SECONDS - 1;
    }
    expect(state.enemyCount).toBeLessThan(MAX_ENEMIES);
    expect(state.enemyCount).toBeGreaterThan(MAX_ENEMIES - 40);
  });
});
