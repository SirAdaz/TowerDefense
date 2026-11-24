import { describe, expect, it } from "vitest";
import { createEnemy, hpScale, isBossWave, regularEnemyCount, spawnInterval, waveComposition } from "./waves.ts";

function countKinds(wave: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const kind of waveComposition(wave)) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}

describe("waves", () => {
  it("has 5 + 2 x wave regular enemies, capped at 60", () => {
    expect(regularEnemyCount(1)).toBe(7);
    expect(regularEnemyCount(10)).toBe(25);
    expect(regularEnemyCount(40)).toBe(60);
  });

  it("only sends normal enemies in waves 1 and 2", () => {
    expect(countKinds(1)).toEqual({ normal: 7 });
    expect(countKinds(2)).toEqual({ normal: 9 });
  });

  it("adds a fast enemy every third slot from wave 3, a tank every fifth slot from wave 5", () => {
    expect(countKinds(3)).toEqual({ normal: 8, fast: 3 });
    expect(waveComposition(5).slice(0, 5)).toEqual(["normal", "normal", "fast", "normal", "tank"]);
    expect(countKinds(5)).toEqual({ normal: 8, fast: 4, tank: 3 });
  });

  it("ends every tenth wave with a boss", () => {
    expect(isBossWave(9)).toBe(false);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(0)).toBe(false);
    expect(waveComposition(10).at(-1)).toBe("boss");
    expect(waveComposition(20).filter((kind) => kind === "boss")).toHaveLength(1);
  });

  it("is deterministic", () => {
    expect(waveComposition(17)).toEqual(waveComposition(17));
  });

  it("spawns faster and faster, never under 0.45 s", () => {
    expect(spawnInterval(1)).toBeCloseTo(0.9);
    expect(spawnInterval(11)).toBeCloseTo(0.7);
    expect(spawnInterval(50)).toBe(0.45);
  });

  it("grows enemy life by 15 % per wave", () => {
    expect(hpScale(1)).toBe(1);
    expect(createEnemy("normal", 1, 1).maxHp).toBe(20);
    expect(createEnemy("normal", 10, 1).maxHp).toBe(70);
    expect(createEnemy("normal", 20, 1).maxHp).toBe(285);
    expect(createEnemy("boss", 10, 1).maxHp).toBe(1759);
  });

  it("gives fast enemies twice the speed and tanks four times the life of a normal one", () => {
    const normal = createEnemy("normal", 1, 1);
    expect(createEnemy("fast", 1, 2).speed).toBe(normal.speed * 2);
    expect(createEnemy("tank", 1, 3).maxHp).toBe(normal.maxHp * 4);
    expect(createEnemy("tank", 1, 3).speed).toBeLessThan(normal.speed);
  });
});
