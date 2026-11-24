import { describe, expect, it } from "vitest";
import { STEP_SECONDS, createGame, earlyCallBonus, startNextWave, step } from "./game.ts";
import type { GameState } from "./types.ts";

function run(state: GameState, seconds: number): void {
  const steps = Math.round(seconds / STEP_SECONDS);
  for (let i = 0; i < steps; i++) step(state, STEP_SECONDS);
}

describe("new game", () => {
  it("starts with 20 lives, 150 $ and waits for the first click", () => {
    const state = createGame();
    expect(state).toMatchObject({ phase: "intermission", wave: 0, lives: 20, money: 150, intermissionLeft: null });
    run(state, 30);
    expect(state.wave).toBe(0);
    expect(earlyCallBonus(state)).toBe(0);
  });
});

describe("waves", () => {
  it("launches wave 1 on click without bonus, then spawns its enemies one by one", () => {
    const state = createGame();
    expect(startNextWave(state)).toBe(true);
    expect(state).toMatchObject({ phase: "wave", wave: 1, money: 150 });
    expect(startNextWave(state)).toBe(false);
    step(state, STEP_SECONDS);
    expect(state.enemies).toHaveLength(1);
    run(state, 1);
    expect(state.enemies).toHaveLength(2);
  });

  it("starts a 10 s countdown when a wave is cleared, then sends the next wave alone", () => {
    const state = createGame();
    startNextWave(state);
    state.spawnQueue = [];
    step(state, STEP_SECONDS);
    expect(state).toMatchObject({ phase: "intermission", intermissionLeft: 10 });
    run(state, 9.9);
    expect(state.wave).toBe(1);
    run(state, 0.2);
    expect(state).toMatchObject({ phase: "wave", wave: 2 });
  });

  it("pays 2 $ per full second left when the next wave is called early", () => {
    const state = createGame();
    startNextWave(state);
    state.spawnQueue = [];
    step(state, STEP_SECONDS);
    run(state, 2.5);
    expect(earlyCallBonus(state)).toBe(14);
    const moneyBefore = state.money;
    startNextWave(state);
    expect(state.money).toBe(moneyBefore + 14);
    expect(earlyCallBonus(state)).toBe(0);
  });

  it("loses the game when the last life is gone, and then stops", () => {
    const state = createGame();
    state.lives = 1;
    startNextWave(state);
    run(state, 40);
    expect(state.phase).toBe("gameOver");
    expect(state.lives).toBe(0);
    const enemiesLeft = state.enemies.length;
    step(state, 1);
    expect(state.enemies).toHaveLength(enemiesLeft);
    expect(startNextWave(state)).toBe(false);
  });
});
