import { describe, expect, it } from "vitest";
import { ARENA_HEIGHT, ARENA_WIDTH, BOSS, COINS, MAX_ENEMIES, PLAYER, RUN_SECONDS, SCORE, STEP_SECONDS } from "./balance.ts";
import { damageEnemy } from "./combat.ts";
import { abandon, coinsEarned, finalScore, step, survivedSeconds } from "./engine.ts";
import { createGame } from "./state.ts";
import type { GameState, PlayerInput } from "./types.ts";
import { chooseUpgrade } from "./upgrades.ts";

const CENTER: PlayerInput = { targetX: ARENA_WIDTH / 2, targetY: ARENA_HEIGHT / 2 };

/** Joue `seconds` secondes sans bouger, en prenant toujours la première carte. */
function run(state: GameState, seconds: number, input: PlayerInput = CENTER): void {
  const steps = Math.round(seconds / STEP_SECONDS);
  for (let index = 0; index < steps; index++) {
    if (state.phase === "levelUp") {
      chooseUpgrade(state, 0);
    }
    step(state, input);
  }
}

function fingerprint(state: GameState): string {
  const enemies = state.enemies.filter((enemy) => enemy.isActive).map((enemy) => `${enemy.kind}:${enemy.x}:${enemy.y}:${enemy.hp}`);
  return JSON.stringify([state.time, state.rngState, state.player, state.kills, state.killPoints, enemies]);
}

describe("step", () => {
  it("replays the same night from the same seed and inputs", () => {
    const first = createGame(42);
    const second = createGame(42);
    run(first, 40);
    run(second, 40);
    expect(fingerprint(first)).toBe(fingerprint(second));
    expect(first.kills).toBeGreaterThan(0);
  });

  it("plays a different night from another seed", () => {
    const first = createGame(1);
    const second = createGame(2);
    run(first, 20);
    run(second, 20);
    expect(fingerprint(first)).not.toBe(fingerprint(second));
  });

  it("advances time by a fixed step and moves the player towards the target at its top speed", () => {
    const state = createGame(1);
    step(state, { targetX: ARENA_WIDTH, targetY: ARENA_HEIGHT / 2 });
    expect(state.time).toBeCloseTo(STEP_SECONDS);
    expect(state.player.x).toBeCloseTo(ARENA_WIDTH / 2 + PLAYER.speed * STEP_SECONDS);
    expect(state.player.y).toBe(ARENA_HEIGHT / 2);
  });

  it("freezes while an upgrade choice is pending", () => {
    const state = createGame(1);
    state.pendingLevelUps = 1;
    step(state, CENTER);
    expect(state.phase).toBe("levelUp");
    expect(state.choices).toHaveLength(3);
    const frozenTime = state.time;
    step(state, CENTER);
    expect(state.time).toBe(frozenTime);
  });

  it("loses when the player runs out of life and then stops", () => {
    const state = createGame(1);
    state.player.hp = 0;
    step(state, CENTER);
    expect(state.phase).toBe("lost");
    const endTime = state.time;
    step(state, CENTER);
    expect(state.time).toBe(endTime);
  });

  it("kills a player who never moves within the first four minutes", () => {
    const state = createGame(7);
    run(state, 240);
    expect(state.phase).toBe("lost");
  });

  it("never holds more objects than its pools, without creating any", () => {
    const state = createGame(3);
    const pools = [state.enemies, state.projectiles, state.gems, state.effects];
    const firstObjects = pools.map((pool) => pool[0]);
    state.player.hp = 1e9;
    state.stats.maxHp = 1e9;
    run(state, 200);
    expect(pools.map((pool) => pool[0])).toEqual(firstObjects);
    expect(state.enemies).toHaveLength(MAX_ENEMIES);
    expect(state.enemyCount).toBe(state.enemies.filter((enemy) => enemy.isActive).length);
    expect(state.enemyCount).toBeLessThanOrEqual(MAX_ENEMIES);
  });
});

describe("the end of the night", () => {
  function nightAtDawn(): GameState {
    const state = createGame(5);
    state.time = RUN_SECONDS - STEP_SECONDS / 2;
    state.player.hp = 1e9;
    step(state, CENTER);
    return state;
  }

  it("brings in the boss once at 10:00 and keeps a thinner flow of enemies", () => {
    const state = nightAtDawn();
    expect(state.isBossSpawned).toBe(true);
    run(state, 10);
    expect(state.enemies.filter((enemy) => enemy.isActive && enemy.kind === "boss")).toHaveLength(1);
    expect(state.enemies.some((enemy) => enemy.isActive && enemy.kind === "swarmer")).toBe(true);
  });

  it("wins when the boss falls", () => {
    const state = nightAtDawn();
    const boss = state.enemies.find((enemy) => enemy.isActive && enemy.kind === "boss");
    expect(boss).toBeDefined();
    if (boss !== undefined) {
      damageEnemy(state, boss, boss.hp);
    }
    step(state, CENTER);
    expect(state.phase).toBe("won");
    expect(finalScore(state)).toBe(state.killPoints + RUN_SECONDS * SCORE.perSecond + BOSS.points);
    expect(coinsEarned(state)).toBe(RUN_SECONDS / COINS.secondsPerCoin + COINS.forVictory);
  });
});

describe("score and coins", () => {
  it("counts kills and seconds survived, capped at the length of the night", () => {
    const state = createGame(1);
    state.time = 125.4;
    state.killPoints = 300;
    state.elitesKilled = 2;
    expect(survivedSeconds(state)).toBe(125);
    expect(finalScore(state)).toBe(300 + 125 * SCORE.perSecond);
    expect(coinsEarned(state)).toBe(12 + 2 * COINS.perElite);
    state.time = RUN_SECONDS + 80;
    expect(survivedSeconds(state)).toBe(RUN_SECONDS);
  });

  it("ends an abandoned run as a loss, once", () => {
    const state = createGame(1);
    abandon(state);
    expect(state.phase).toBe("lost");
    state.phase = "won";
    abandon(state);
    expect(state.phase).toBe("won");
  });
});
