import { describe, expect, it } from "vitest";
import { canStartWave, createGame, earlyBonus, startNextWave, step } from "./engine.ts";
import { PATH_LENGTH } from "./grid.ts";
import { buildTower, upgradeTower } from "./towers.ts";
import type { Enemy, GameEvent, GameState } from "./types.ts";
import { waveSize } from "./waves.ts";

const STEPS_PER_SECOND = 60;

function run(state: GameState, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i++) {
    events.push(...step(state));
  }
  return events;
}

function runUntil(state: GameState, isDone: () => boolean, maxSeconds = 600): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < maxSeconds * STEPS_PER_SECOND && !isDone(); i++) {
    events.push(...step(state));
  }
  return events;
}

/** Vague en cours dont tous les ennemis sont déjà entrés : il ne reste que ceux qu'on pose à la main. */
function waveWith(wave: number, enemies: Enemy[]): GameState {
  const state = createGame();
  state.phase = "wave";
  state.wave = wave;
  state.spawnedCount = waveSize(wave);
  state.enemies = enemies;
  return state;
}

function enemyNearExit(kind: Enemy["kind"], id = 1): Enemy {
  return { id, kind, hp: 1000, maxHp: 1000, distance: PATH_LENGTH - 0.01 };
}

describe("start of the game", () => {
  it("starts with 20 lives, 150 money and waits for a click before wave 1", () => {
    const state = createGame();
    expect(state).toMatchObject({ phase: "ready", wave: 0, lives: 20, money: 150 });
    expect(run(state, 30)).toEqual([]);
    expect(state.phase).toBe("ready");
    expect(state.wave).toBe(0);
  });

  it("starts wave 1 on demand, with no bonus", () => {
    const state = createGame();
    expect(canStartWave(state)).toBe(true);
    expect(startNextWave(state)).toEqual([{ type: "waveStarted", wave: 1, bonus: 0 }]);
    expect(state).toMatchObject({ phase: "wave", wave: 1, money: 150 });
    expect(canStartWave(state)).toBe(false);
    expect(startNextWave(state)).toEqual([]);
    expect(state.wave).toBe(1);
  });
});

describe("enemies", () => {
  it("enter one by one, 0.9 s apart in wave 1", () => {
    const state = createGame();
    startNextWave(state);
    step(state);
    expect(state.enemies).toHaveLength(1);
    run(state, 0.8);
    expect(state.enemies).toHaveLength(1);
    run(state, 0.2);
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies[0]).toMatchObject({ kind: "normal", hp: 24, maxHp: 24 });
  });

  it("walk at their own speed: a fast one covers twice the distance of a normal one", () => {
    const state = waveWith(3, [
      { id: 1, kind: "normal", hp: 10, maxHp: 10, distance: 0 },
      { id: 2, kind: "fast", hp: 10, maxHp: 10, distance: 0 },
      { id: 3, kind: "tank", hp: 10, maxHp: 10, distance: 0 },
    ]);
    run(state, 5);
    expect(state.enemies.map((enemy) => Number(enemy.distance.toFixed(3)))).toEqual([6, 12, 3.5]);
  });

  it("cost 1 life at the exit", () => {
    const state = waveWith(2, [enemyNearExit("normal"), enemyNearExit("tank", 2), enemyNearExit("fast", 3)]);
    const events = run(state, 0.1);
    expect(state.lives).toBe(17);
    expect(state.enemies).toHaveLength(0);
    expect(events.filter((event) => event.type === "leaked")).toHaveLength(3);
  });

  it("cost 5 lives when a boss reaches the exit", () => {
    const state = waveWith(10, [enemyNearExit("boss")]);
    const events = run(state, 0.1);
    expect(state.lives).toBe(15);
    expect(events).toContainEqual({ type: "leaked", kind: "boss", livesLost: 5 });
  });
});

describe("towers in action", () => {
  it("hit the enemy in range that is furthest along the path, once per second at level 1", () => {
    const state = waveWith(1, [
      { id: 1, kind: "tank", hp: 500, maxHp: 500, distance: 2 },
      { id: 2, kind: "tank", hp: 500, maxHp: 500, distance: 3 },
      { id: 3, kind: "tank", hp: 500, maxHp: 500, distance: 20 },
    ]);
    buildTower(state, { col: 3, row: 2 });
    const events = run(state, 0.5);
    expect(events.filter((event) => event.type === "shot")).toHaveLength(1);
    expect(state.enemies.map((enemy) => enemy.hp)).toEqual([500, 490, 500]);
    run(state, 1);
    expect(state.enemies.map((enemy) => enemy.hp)).toEqual([500, 480, 500]);
  });

  it("do not shoot out of range, until the range gauge is upgraded", () => {
    const state = waveWith(1, [{ id: 1, kind: "tank", hp: 500, maxHp: 500, distance: 0 }]);
    state.money = 1000;
    const tower = buildTower(state, { col: 2, row: 2 });
    expect(step(state).filter((event) => event.type === "shot")).toHaveLength(0);
    upgradeTower(state, tower?.id ?? 0, "range");
    expect(step(state).filter((event) => event.type === "shot")).toHaveLength(1);
  });

  it("shoot harder and faster with upgraded gauges", () => {
    const state = waveWith(1, [{ id: 1, kind: "tank", hp: 5000, maxHp: 5000, distance: 3 }]);
    state.money = 1000;
    const tower = buildTower(state, { col: 3, row: 2 });
    upgradeTower(state, tower?.id ?? 0, "damage");
    upgradeTower(state, tower?.id ?? 0, "rate");
    upgradeTower(state, tower?.id ?? 0, "rate");
    const shots = run(state, 2).filter((event) => event.type === "shot");
    expect(shots).toHaveLength(4);
    expect(state.enemies[0]?.hp).toBe(5000 - 4 * 16);
  });

  it("earn the bounty when an enemy dies", () => {
    const state = waveWith(1, [
      { id: 1, kind: "normal", hp: 5, maxHp: 24, distance: 3 },
      { id: 2, kind: "tank", hp: 500, maxHp: 500, distance: 1 },
    ]);
    state.money = 50;
    buildTower(state, { col: 3, row: 2 });
    const events = step(state);
    expect(events).toContainEqual(expect.objectContaining({ type: "killed", kind: "normal", bounty: 5 }));
    expect(state.money).toBe(5);
    expect(state.enemies.map((enemy) => enemy.id)).toEqual([2]);
  });
});

describe("waves", () => {
  it("start a 10 s countdown once the wave is cleared, then leave on their own", () => {
    const state = waveWith(1, [enemyNearExit("normal")]);
    const events = run(state, 0.1);
    expect(events).toContainEqual({ type: "waveCleared", wave: 1 });
    expect(state.phase).toBe("countdown");
    expect(state.countdown).toBeCloseTo(10, 0);
    run(state, 9);
    expect(state.phase).toBe("countdown");
    const moneyBefore = state.money;
    const started = run(state, 1.2).filter((event) => event.type === "waveStarted");
    expect(started).toEqual([{ type: "waveStarted", wave: 2, bonus: 0 }]);
    expect(state).toMatchObject({ phase: "wave", wave: 2, money: moneyBefore });
  });

  it("pay 2 per whole second left when the next wave is called early", () => {
    const state = waveWith(1, [enemyNearExit("normal")]);
    run(state, 0.1);
    run(state, 2.5);
    expect(earlyBonus(state)).toBe(14);
    const moneyBefore = state.money;
    expect(startNextWave(state)).toEqual([{ type: "waveStarted", wave: 2, bonus: 14 }]);
    expect(state.money).toBe(moneyBefore + 14);
    expect(earlyBonus(state)).toBe(0);
  });

  it("do not end while enemies are still to enter", () => {
    const state = createGame();
    state.money = 5000;
    startNextWave(state);
    buildTower(state, { col: 1, row: 2 });
    buildTower(state, { col: 2, row: 2 });
    buildTower(state, { col: 3, row: 2 });
    const events = runUntil(state, () => state.phase === "countdown");
    expect(events.filter((event) => event.type === "killed")).toHaveLength(8);
    expect(state.lives).toBe(20);
    expect(state.money).toBe(5000 - 150 + 8 * 5);
  });

  it("send the boss last in wave 10", () => {
    const state = createGame();
    state.wave = 9;
    state.phase = "countdown";
    state.countdown = 0.01;
    runUntil(state, () => state.spawnedCount === waveSize(10));
    expect(state.wave).toBe(10);
    expect(state.enemies.at(-1)).toMatchObject({ kind: "boss", hp: 1331 });
  });
});

describe("defeat", () => {
  it("ends the game when lives reach 0 and freezes everything", () => {
    const state = waveWith(10, [enemyNearExit("boss"), enemyNearExit("normal", 2)]);
    state.lives = 3;
    const events = run(state, 0.1);
    expect(state.lives).toBe(0);
    expect(state.phase).toBe("over");
    expect(events.filter((event) => event.type === "gameOver")).toEqual([{ type: "gameOver", wave: 10 }]);
    expect(run(state, 20)).toEqual([]);
    expect(canStartWave(state)).toBe(false);
  });

  it("is reached around wave 3 without any tower", () => {
    const state = createGame();
    startNextWave(state);
    runUntil(state, () => state.phase === "over");
    expect(state.phase).toBe("over");
    expect(state.wave).toBe(3);
  });

  it("replays identically: same actions, same game", () => {
    const play = (): GameState => {
      const state = createGame();
      buildTower(state, { col: 3, row: 2 });
      buildTower(state, { col: 6, row: 3 });
      startNextWave(state);
      run(state, 90);
      return state;
    };
    expect(play()).toEqual(play());
  });
});
