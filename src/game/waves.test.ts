import { describe, expect, it } from "vitest";
import { enemyKindAt, enemyMaxHp, isBossWave, regularEnemyCount, spawnInterval, waveSize } from "./waves.ts";

function roster(wave: number): string[] {
  return Array.from({ length: waveSize(wave) }, (_, index) => enemyKindAt(wave, index));
}

describe("waves", () => {
  it("grows by two enemies per wave, capped at 50", () => {
    expect(regularEnemyCount(1)).toBe(8);
    expect(regularEnemyCount(10)).toBe(26);
    expect(regularEnemyCount(22)).toBe(50);
    expect(regularEnemyCount(80)).toBe(50);
  });

  it("only has normal enemies in waves 1 and 2", () => {
    expect(new Set(roster(1))).toEqual(new Set(["normal"]));
    expect(new Set(roster(2))).toEqual(new Set(["normal"]));
  });

  it("ends with a pack of fast enemies from wave 3", () => {
    expect(roster(3)).toEqual([...Array<string>(8).fill("normal"), ...Array<string>(4).fill("fast")]);
  });

  it("puts a tank every fourth enemy from wave 4", () => {
    const wave4 = roster(4);
    expect(wave4).toHaveLength(14);
    expect(wave4.filter((kind) => kind === "tank")).toHaveLength(3);
    expect(wave4[3]).toBe("tank");
    expect(wave4[7]).toBe("tank");
    expect(wave4[13]).toBe("fast");
  });

  it("adds one boss, last, every 10 waves", () => {
    expect(isBossWave(0)).toBe(false);
    expect(isBossWave(9)).toBe(false);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(20)).toBe(true);
    expect(waveSize(10)).toBe(27);
    expect(roster(10).at(-1)).toBe("boss");
    expect(roster(10).filter((kind) => kind === "boss")).toHaveLength(1);
    expect(roster(9)).not.toContain("boss");
  });

  it("tightens the spawn interval down to a floor", () => {
    expect(spawnInterval(1)).toBeCloseTo(0.9);
    expect(spawnInterval(11)).toBeCloseTo(0.7);
    expect(spawnInterval(40)).toBeCloseTo(0.4);
  });

  it("multiplies enemy health by 1.12 each wave", () => {
    expect(enemyMaxHp("normal", 1)).toBe(24);
    expect(enemyMaxHp("fast", 1)).toBe(12);
    expect(enemyMaxHp("tank", 1)).toBe(96);
    expect(enemyMaxHp("normal", 10)).toBe(67);
    expect(enemyMaxHp("normal", 20)).toBe(207);
    expect(enemyMaxHp("boss", 10)).toBe(1331);
    expect(enemyMaxHp("boss", 20)).toBe(4134);
  });
});
