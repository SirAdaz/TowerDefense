import { describe, expect, it } from "vitest";
import { ARENA_WIDTH, ELITE, ENEMIES, MAX_EFFECTS, MAX_GEMS, MAX_PROJECTILES, PLAYER, STEP_SECONDS, WEAPONS } from "./balance.ts";
import { damageArea, damageEnemy, dropGem, EFFECT_SECONDS, spawnEffect, updateEffects } from "./combat.ts";
import { promoteToElite, spawnEnemy } from "./enemies.ts";
import { updateGems } from "./gems.ts";
import { updateProjectiles } from "./projectiles.ts";
import { rebuildGrid } from "./spatial.ts";
import { createGame } from "./state.ts";
import type { Enemy, EnemyKind, GameState, WeaponId } from "./types.ts";
import { findNearestEnemy, updateWeapons, weaponLevel } from "./weapons.ts";

function place(state: GameState, kind: EnemyKind, offsetX: number, offsetY = 0): Enemy {
  const enemy = spawnEnemy(state, kind, state.player.x + offsetX, state.player.y + offsetY);
  if (enemy === null) {
    throw new Error("Enemy pool is full");
  }
  rebuildGrid(state);
  return enemy;
}

/** Partie où seule l'arme donnée est en main, au niveau donné. */
function armedWith(id: WeaponId, level: number): GameState {
  const state = createGame(11);
  state.weapons.spark.level = 0;
  state.weapons[id].level = level;
  return state;
}

function tick(state: GameState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP_SECONDS) {
    rebuildGrid(state);
    updateWeapons(state, STEP_SECONDS);
    updateProjectiles(state, STEP_SECONDS);
  }
}

const activeProjectiles = (state: GameState) => state.projectiles.filter((projectile) => projectile.isActive);

describe("spark", () => {
  it("fires at the nearest enemy and waits for its cooldown", () => {
    const state = createGame(1);
    place(state, "brute", 600);
    const near = place(state, "brute", 0, -200);
    expect(findNearestEnemy(state)).toBe(near);
    updateWeapons(state, STEP_SECONDS);
    const [shot] = activeProjectiles(state);
    expect(shot?.vx).toBeCloseTo(0);
    expect(shot?.vy).toBeLessThan(0);
    updateWeapons(state, STEP_SECONDS);
    expect(activeProjectiles(state)).toHaveLength(1);
    tick(state, WEAPONS.spark.levels[0]?.cooldown ?? 0);
    expect(near.hp).toBeLessThan(near.maxHp);
  });

  it("holds its fire in an empty arena", () => {
    const state = createGame(1);
    tick(state, 2);
    expect(activeProjectiles(state)).toHaveLength(0);
    expect(findNearestEnemy(state)).toBeNull();
  });

  it("fans out several shots at higher levels and applies the damage bonus", () => {
    const state = armedWith("spark", 5);
    state.stats.damageMultiplier = 2;
    place(state, "brute", 300);
    updateWeapons(state, STEP_SECONDS);
    const shots = activeProjectiles(state);
    expect(shots).toHaveLength(3);
    expect(new Set(shots.map((shot) => shot.vy.toFixed(3))).size).toBe(3);
    expect(shots[0]?.damage).toBe((WEAPONS.spark.levels[4]?.damage ?? 0) * 2);
  });

  it("stops on the first enemy, or goes through one more when it pierces", () => {
    const plain = armedWith("spark", 1);
    const front = place(plain, "brute", 80);
    const behind = place(plain, "brute", 150);
    tick(plain, 0.4);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBe(behind.maxHp);

    const piercing = armedWith("spark", 4);
    piercing.stats.cooldownMultiplier = 100;
    const first = place(piercing, "brute", 80);
    const second = place(piercing, "brute", 150);
    const third = place(piercing, "brute", 220);
    tick(piercing, 0.6);
    const damage = (WEAPONS.spark.levels[3]?.damage ?? 0) * 2;
    expect(first.maxHp - first.hp).toBe(damage);
    expect(second.maxHp - second.hp).toBe(damage);
    expect(third.hp).toBe(third.maxHp);
  });

  it("gives up when every projectile is in flight", () => {
    const state = createGame(1);
    for (const projectile of state.projectiles) {
      projectile.isActive = true;
      projectile.secondsLeft = 5;
    }
    place(state, "brute", 300);
    updateWeapons(state, STEP_SECONDS);
    expect(activeProjectiles(state)).toHaveLength(MAX_PROJECTILES);
  });
});

describe("lance", () => {
  it("goes through every enemy on its way and hits each one once", () => {
    const state = armedWith("lance", 1);
    const targets = [60, 120, 180, 240].map((offsetX) => place(state, "brute", offsetX));
    tick(state, 1);
    const damage = WEAPONS.lance.levels[0]?.damage ?? 0;
    for (const target of targets) {
      expect(target.maxHp - target.hp).toBe(damage);
    }
  });

  it("sends a second comet the opposite way from level 3", () => {
    const state = armedWith("lance", 3);
    place(state, "brute", 300);
    updateWeapons(state, STEP_SECONDS);
    const [first, second] = activeProjectiles(state);
    expect(first?.vx).toBeCloseTo(-(second?.vx ?? 0));
  });

  it("dies out past the edge of the arena or at the end of its life", () => {
    const state = armedWith("lance", 1);
    place(state, "brute", ARENA_WIDTH / 2 - 20);
    updateWeapons(state, STEP_SECONDS);
    tick(state, 3);
    expect(activeProjectiles(state).every((projectile) => projectile.x <= ARENA_WIDTH + 80)).toBe(true);
    const [lost] = state.projectiles;
    if (lost !== undefined) {
      lost.isActive = true;
      lost.x = state.player.x;
      lost.vx = 0;
      lost.vy = 0;
      lost.secondsLeft = STEP_SECONDS / 2;
    }
    updateProjectiles(state, STEP_SECONDS);
    expect(lost?.isActive).toBe(false);
  });
});

describe("halo", () => {
  it("burns what its orbs touch, a little every step", () => {
    const state = armedWith("halo", 1);
    const level = weaponLevel(state, "halo");
    const target = place(state, "brute", level?.area ?? 0);
    const farAway = place(state, "brute", 500);
    tick(state, 2);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(farAway.hp).toBe(farAway.maxHp);
  });
});

describe("pulse", () => {
  it("hurts and pushes back the enemies around the player, not the boss", () => {
    const state = armedWith("pulse", 1);
    const near = place(state, "brute", 100);
    const far = place(state, "brute", 400);
    const boss = place(state, "boss", 0, 120);
    updateWeapons(state, STEP_SECONDS);
    expect(near.maxHp - near.hp).toBe(WEAPONS.pulse.levels[0]?.damage);
    expect(near.pushX).toBeGreaterThan(0);
    expect(far.hp).toBe(far.maxHp);
    expect(far.pushX).toBe(0);
    expect(boss.hp).toBeLessThan(boss.maxHp);
    expect(boss.pushY).toBe(0);
    expect(state.weapons.pulse.effectAge).toBe(0);
    updateWeapons(state, STEP_SECONDS);
    expect(near.maxHp - near.hp).toBe(WEAPONS.pulse.levels[0]?.damage);
  });
});

describe("storm", () => {
  it("strikes random enemies inside the arena and marks the impact", () => {
    const state = armedWith("storm", 1);
    const inside = place(state, "brute", 300);
    const outside = place(state, "brute", 0);
    outside.x = -30;
    rebuildGrid(state);
    updateWeapons(state, STEP_SECONDS);
    expect(inside.maxHp - inside.hp).toBe((WEAPONS.storm.levels[0]?.damage ?? 0) * 2);
    expect(outside.hp).toBe(outside.maxHp);
    expect(state.effects.filter((effect) => effect.isActive && effect.kind === "bolt")).toHaveLength(2);
  });

  it("waits for a target instead of wasting its charge", () => {
    const state = armedWith("storm", 1);
    updateWeapons(state, STEP_SECONDS);
    expect(state.weapons.storm.cooldown).toBeLessThanOrEqual(0);
    const target = place(state, "brute", 200);
    updateWeapons(state, STEP_SECONDS);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(state.weapons.storm.cooldown).toBeGreaterThan(0);
  });
});

describe("kills, gems and effects", () => {
  it("turns a kill into points, a gem and a burst", () => {
    const state = createGame(1);
    const drifter = place(state, "drifter", 300);
    damageEnemy(state, drifter, 1);
    expect(drifter.isActive).toBe(true);
    damageEnemy(state, drifter, 999);
    expect(drifter.isActive).toBe(false);
    expect(state.enemyCount).toBe(0);
    expect(state.kills).toBe(1);
    expect(state.killPoints).toBe(ENEMIES.drifter.points);
    expect(state.gems.filter((gem) => gem.isActive)).toHaveLength(1);
    expect(state.effects.filter((effect) => effect.isActive)).toHaveLength(1);
  });

  it("rewards an elite with more points and a bigger gem", () => {
    const state = createGame(1);
    const elite = place(state, "drifter", 300);
    promoteToElite(elite);
    damageEnemy(state, elite, elite.hp);
    expect(state.elitesKilled).toBe(1);
    expect(state.killPoints).toBe(ENEMIES.drifter.points * ELITE.pointsFactor);
    expect(state.gems.find((gem) => gem.isActive)?.value).toBe(ENEMIES.drifter.xp + ELITE.xp);
  });

  it("damages every enemy touching a disc and skips the dead ones", () => {
    const state = createGame(1);
    const inside = place(state, "drifter", 50);
    const dead = place(state, "drifter", 60);
    const outside = place(state, "drifter", 300);
    dead.isActive = false;
    expect(damageArea(state, state.player, 80, 3)).toBe(1);
    expect(inside.hp).toBe(inside.maxHp - 3);
    expect(outside.hp).toBe(outside.maxHp);
  });

  it("pulls gems within reach and turns them into experience", () => {
    const state = createGame(1);
    dropGem(state, { x: state.player.x + PLAYER.pickupRadius - 5, y: state.player.y }, 1);
    dropGem(state, { x: state.player.x + 600, y: state.player.y }, 1);
    for (let elapsed = 0; elapsed < 1; elapsed += STEP_SECONDS) {
      updateGems(state, STEP_SECONDS);
    }
    expect(state.player.xp).toBe(1);
    expect(state.gems.filter((gem) => gem.isActive)).toHaveLength(1);
  });

  it("keeps a gem inside the arena and never loses experience when the pool is full", () => {
    const state = createGame(1);
    dropGem(state, { x: -80, y: 5000 }, 1);
    const [first] = state.gems;
    expect(first?.x).toBeGreaterThan(0);
    expect(first?.y).toBeLessThan(900);
    for (let index = 1; index < MAX_GEMS; index++) {
      dropGem(state, state.player, 1);
    }
    dropGem(state, state.player, 7);
    expect(first?.value).toBe(8);
  });

  it("lets effects fade and drops new ones when the pool is full", () => {
    const state = createGame(1);
    for (let index = 0; index < MAX_EFFECTS + 5; index++) {
      spawnEffect(state, "burst", state.player, 10);
    }
    expect(state.effects.filter((effect) => effect.isActive)).toHaveLength(MAX_EFFECTS);
    for (let elapsed = 0; elapsed <= EFFECT_SECONDS; elapsed += STEP_SECONDS) {
      updateEffects(state, STEP_SECONDS);
    }
    expect(state.effects.some((effect) => effect.isActive)).toBe(false);
  });
});
