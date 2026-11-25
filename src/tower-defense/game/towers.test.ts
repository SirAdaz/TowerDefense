import { describe, expect, it } from "vitest";
import { ENEMY_STATS, GAUGES } from "./balance.ts";
import { createGame } from "./engine.ts";
import {
  buildTower,
  gaugeValue,
  isBuildable,
  sellTower,
  sellValue,
  towerAt,
  towerSpent,
  towerStat,
  upgradeCost,
  upgradeTower,
} from "./towers.ts";

const FREE_CELL = { col: 3, row: 2 };

describe("building", () => {
  it("places a level 1 tower on a free cell for 50", () => {
    const state = createGame();
    const tower = buildTower(state, FREE_CELL);
    expect(tower).toMatchObject({ col: 3, row: 2, levels: { damage: 1, range: 1, rate: 1 } });
    expect(state.money).toBe(100);
    expect(towerAt(state, FREE_CELL)).toBe(tower);
  });

  it("refuses the path, an occupied cell, the outside and an empty wallet", () => {
    const state = createGame();
    expect(buildTower(state, { col: 0, row: 1 })).toBeNull();
    expect(buildTower(state, { col: 16, row: 0 })).toBeNull();
    buildTower(state, FREE_CELL);
    expect(isBuildable(state, FREE_CELL)).toBe(false);
    expect(buildTower(state, FREE_CELL)).toBeNull();
    state.money = 49;
    expect(buildTower(state, { col: 0, row: 0 })).toBeNull();
    expect(state.towers).toHaveLength(1);
    expect(state.money).toBe(49);
  });

  it("refuses everything once the game is over", () => {
    const state = createGame();
    const tower = buildTower(state, FREE_CELL);
    state.phase = "over";
    expect(buildTower(state, { col: 0, row: 0 })).toBeNull();
    expect(upgradeTower(state, tower?.id ?? 0, "damage")).toBe(false);
    expect(sellTower(state, tower?.id ?? 0)).toBeNull();
  });
});

describe("gauges", () => {
  it("has 5 increasing levels per gauge", () => {
    for (const gauge of GAUGES) {
      for (let level = 2; level <= 5; level++) {
        expect(gaugeValue(gauge, level)).toBeGreaterThan(gaugeValue(gauge, level - 1));
      }
    }
    expect(gaugeValue("damage", 1)).toBe(10);
    expect(gaugeValue("range", 5)).toBe(3.6);
    expect(gaugeValue("rate", 5)).toBe(2.8);
    expect(gaugeValue("damage", 0)).toBe(10);
    expect(gaugeValue("damage", 9)).toBe(46);
  });

  it("costs more and more: 30, 60, 110 then 180, and nothing after level 5", () => {
    expect([1, 2, 3, 4, 5].map(upgradeCost)).toEqual([30, 60, 110, 180, null]);
  });

  it("upgrades each gauge independently", () => {
    const state = createGame();
    const tower = buildTower(state, FREE_CELL);
    if (tower === null) {
      throw new Error("tower expected");
    }
    expect(upgradeTower(state, tower.id, "range")).toBe(true);
    expect(tower.levels).toEqual({ damage: 1, range: 2, rate: 1 });
    expect(towerStat(tower, "range")).toBe(2.4);
    expect(towerStat(tower, "damage")).toBe(10);
    expect(state.money).toBe(70);
  });

  it("refuses an upgrade without money, at max level or on an unknown tower", () => {
    const state = createGame();
    const tower = buildTower(state, FREE_CELL);
    if (tower === null) {
      throw new Error("tower expected");
    }
    state.money = 29;
    expect(upgradeTower(state, tower.id, "damage")).toBe(false);
    state.money = 10_000;
    for (let level = 1; level < 5; level++) {
      expect(upgradeTower(state, tower.id, "damage")).toBe(true);
    }
    expect(upgradeTower(state, tower.id, "damage")).toBe(false);
    expect(tower.levels.damage).toBe(5);
    expect(state.money).toBe(10_000 - 380);
    expect(upgradeTower(state, 999, "damage")).toBe(false);
  });
});

describe("selling", () => {
  it("gives back 75 % of everything spent, rounded down", () => {
    const state = createGame();
    const tower = buildTower(state, FREE_CELL);
    if (tower === null) {
      throw new Error("tower expected");
    }
    expect(sellValue(tower)).toBe(37);
    upgradeTower(state, tower.id, "damage");
    upgradeTower(state, tower.id, "rate");
    expect(towerSpent(tower)).toBe(110);
    expect(sellTower(state, tower.id)).toBe(82);
    expect(state.towers).toHaveLength(0);
    expect(state.money).toBe(150 - 110 + 82);
    expect(sellTower(state, tower.id)).toBeNull();
  });

  it("makes a fully upgraded tower cost 1190", () => {
    const state = createGame();
    state.money = 5000;
    const tower = buildTower(state, FREE_CELL);
    if (tower === null) {
      throw new Error("tower expected");
    }
    for (const gauge of GAUGES) {
      for (let level = 1; level < 5; level++) {
        upgradeTower(state, tower.id, gauge);
      }
    }
    expect(towerSpent(tower)).toBe(1190);
    expect(state.money).toBe(5000 - 1190);
  });
});

describe("enemy rules", () => {
  it("makes the fast enemy twice as fast with little health, the tank slow with 4 times the health", () => {
    expect(ENEMY_STATS.fast.speed).toBe(ENEMY_STATS.normal.speed * 2);
    expect(ENEMY_STATS.fast.baseHp).toBeLessThan(ENEMY_STATS.normal.baseHp);
    expect(ENEMY_STATS.tank.baseHp).toBe(ENEMY_STATS.normal.baseHp * 4);
    expect(ENEMY_STATS.tank.speed).toBeLessThan(ENEMY_STATS.normal.speed);
  });

  it("makes a boss cost 5 lives and the others 1", () => {
    expect(ENEMY_STATS.boss.livesLost).toBe(5);
    expect(ENEMY_STATS.normal.livesLost).toBe(1);
    expect(ENEMY_STATS.fast.livesLost).toBe(1);
    expect(ENEMY_STATS.tank.livesLost).toBe(1);
  });
});
