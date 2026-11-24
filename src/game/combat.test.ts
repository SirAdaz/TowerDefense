import { describe, expect, it } from "vitest";
import { fireTowers, moveEnemies, moveProjectiles, pickTarget } from "./combat.ts";
import { createGame } from "./game.ts";
import { PATH_LENGTH } from "./grid.ts";
import { buildTower } from "./towers.ts";
import type { GameState } from "./types.ts";
import { createEnemy } from "./waves.ts";

/** Tourelle en (3, 2) : le chemin passe en (3, 1), juste au-dessus. */
function gameWithTower(): { state: GameState; towerId: number } {
  const state = createGame();
  const tower = buildTower(state, { col: 3, row: 2 });
  if (!tower) throw new Error("tower expected");
  return { state, towerId: tower.id };
}

function addEnemy(state: GameState, distance: number, kind: "normal" | "boss" = "normal") {
  const enemy = createEnemy(kind, 1, state.nextId++);
  enemy.distance = distance;
  state.enemies.push(enemy);
  return enemy;
}

describe("enemy movement", () => {
  it("moves enemies by speed x time", () => {
    const state = createGame();
    const enemy = addEnemy(state, 0);
    moveEnemies(state, 1);
    expect(enemy.distance).toBeCloseTo(1.4);
  });

  it("takes one life per ordinary enemy reaching the exit", () => {
    const state = createGame();
    addEnemy(state, PATH_LENGTH - 0.01);
    addEnemy(state, PATH_LENGTH - 0.01);
    moveEnemies(state, 1);
    expect(state.lives).toBe(18);
    expect(state.enemies).toHaveLength(0);
  });

  it("takes five lives when a boss reaches the exit", () => {
    const state = createGame();
    addEnemy(state, PATH_LENGTH - 0.01, "boss");
    moveEnemies(state, 1);
    expect(state.lives).toBe(15);
    expect(state.enemies).toHaveLength(0);
  });

  it("never takes lives below zero", () => {
    const state = createGame();
    state.lives = 3;
    addEnemy(state, PATH_LENGTH - 0.01, "boss");
    moveEnemies(state, 1);
    expect(state.lives).toBe(0);
  });
});

describe("targeting", () => {
  it("aims at the enemy in range that is furthest along the path", () => {
    const { state } = gameWithTower();
    const behind = addEnemy(state, 2);
    const ahead = addEnemy(state, 3.5);
    addEnemy(state, 20);
    const tower = state.towers[0];
    if (!tower) throw new Error("tower expected");
    expect(pickTarget(tower, state.enemies)).toBe(ahead);
    expect(pickTarget(tower, [behind])).toBe(behind);
    expect(pickTarget(tower, [])).toBeUndefined();
  });
});

describe("shooting", () => {
  it("fires once per 1 / rate seconds and does not fire without a target", () => {
    const { state } = gameWithTower();
    fireTowers(state, 0.1);
    expect(state.projectiles).toHaveLength(0);
    addEnemy(state, 3);
    fireTowers(state, 0.1);
    fireTowers(state, 0.5);
    expect(state.projectiles).toHaveLength(1);
    fireTowers(state, 0.5);
    expect(state.projectiles).toHaveLength(2);
  });

  it("kills, pays the reward and credits the tower", () => {
    const { state } = gameWithTower();
    const enemy = addEnemy(state, 3);
    enemy.hp = 5;
    fireTowers(state, 0.1);
    for (let i = 0; i < 60 && state.enemies.length > 0; i++) moveProjectiles(state, 1 / 60);
    expect(state.enemies).toHaveLength(0);
    expect(state.money).toBe(100 + 5);
    expect(state.towers[0]?.kills).toBe(1);
    expect(state.projectiles).toHaveLength(0);
  });

  it("only damages an enemy that survives the hit", () => {
    const { state } = gameWithTower();
    const enemy = addEnemy(state, 3);
    fireTowers(state, 0.1);
    for (let i = 0; i < 60 && state.projectiles.length > 0; i++) moveProjectiles(state, 1 / 60);
    expect(enemy.hp).toBe(10);
    expect(state.money).toBe(100);
  });

  it("drops a projectile whose target is gone", () => {
    const { state } = gameWithTower();
    addEnemy(state, 3);
    fireTowers(state, 0.1);
    state.enemies = [];
    moveProjectiles(state, 1 / 60);
    expect(state.projectiles).toHaveLength(0);
  });
});
