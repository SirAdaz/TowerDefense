import { describe, expect, it } from "vitest";
import { createGame } from "./game.ts";
import { buildTower, isBuildable, sellTower, sellValue, towerAt, towerStats, upgradeCost, upgradeTower } from "./towers.ts";

const GRASS = { col: 0, row: 0 };
const PATH_CELL = { col: 0, row: 1 };

describe("building", () => {
  it("builds on free grass for 50 $", () => {
    const state = createGame();
    const tower = buildTower(state, GRASS);
    expect(tower).not.toBeNull();
    expect(state.money).toBe(100);
    expect(tower?.levels).toEqual({ damage: 1, range: 1, rate: 1 });
    expect(towerAt(state, GRASS)).toBe(tower);
  });

  it("refuses the path, an occupied cell, a cell outside the map and an empty wallet", () => {
    const state = createGame();
    expect(buildTower(state, PATH_CELL)).toBeNull();
    buildTower(state, GRASS);
    expect(buildTower(state, GRASS)).toBeNull();
    expect(isBuildable(state, { col: 16, row: 0 })).toBe(false);
    state.money = 49;
    expect(buildTower(state, { col: 1, row: 0 })).toBeNull();
    expect(state.money).toBe(49);
  });

  it("does nothing once the game is lost", () => {
    const state = createGame();
    state.phase = "gameOver";
    expect(buildTower(state, GRASS)).toBeNull();
  });
});

describe("upgrades", () => {
  it("costs 25, 50, 90 then 150 $ and stops at level 5", () => {
    expect([1, 2, 3, 4].map(upgradeCost)).toEqual([25, 50, 90, 150]);
    expect(upgradeCost(5)).toBeNull();
  });

  it("raises one gauge only and keeps track of the money spent", () => {
    const state = createGame();
    state.money = 1000;
    const tower = buildTower(state, GRASS);
    if (!tower) throw new Error("tower expected");
    expect(upgradeTower(state, tower.id, "range")).toBe(true);
    expect(tower.levels).toEqual({ damage: 1, range: 2, rate: 1 });
    expect(tower.spent).toBe(75);
    expect(state.money).toBe(925);
    expect(towerStats(tower.levels)).toEqual({ damage: 10, range: 2.5, fireRate: 1 });
  });

  it("refuses an upgrade without enough money, past level 5 or for an unknown tower", () => {
    const state = createGame();
    state.money = 2000;
    const tower = buildTower(state, GRASS);
    if (!tower) throw new Error("tower expected");
    for (let level = 1; level < 5; level++) upgradeTower(state, tower.id, "damage");
    expect(tower.levels.damage).toBe(5);
    expect(upgradeTower(state, tower.id, "damage")).toBe(false);
    expect(towerStats(tower.levels).damage).toBe(56);
    state.money = 10;
    expect(upgradeTower(state, tower.id, "rate")).toBe(false);
    expect(upgradeTower(state, 999, "rate")).toBe(false);
  });

  it("costs 995 $ for a fully upgraded tower", () => {
    const state = createGame();
    state.money = 995;
    const tower = buildTower(state, GRASS);
    if (!tower) throw new Error("tower expected");
    for (const gauge of ["damage", "range", "rate"] as const) {
      for (let level = 1; level < 5; level++) upgradeTower(state, tower.id, gauge);
    }
    expect(state.money).toBe(0);
    expect(tower.spent).toBe(995);
  });
});

describe("selling", () => {
  it("gives back 70 % of everything spent, rounded down", () => {
    const state = createGame();
    const tower = buildTower(state, GRASS);
    if (!tower) throw new Error("tower expected");
    upgradeTower(state, tower.id, "damage");
    expect(sellValue(tower)).toBe(52);
    expect(sellTower(state, tower.id)).toBe(true);
    expect(state.money).toBe(75 + 52);
    expect(state.towers).toHaveLength(0);
    expect(sellTower(state, tower.id)).toBe(false);
  });
});
