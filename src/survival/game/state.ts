import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ELITE,
  MAX_EFFECTS,
  MAX_ENEMIES,
  MAX_GEMS,
  MAX_HIT_MARKS,
  MAX_PROJECTILES,
  PASSIVE_IDS,
  PLAYER,
  STARTING_WEAPON,
  WEAPON_IDS,
  XP_BASE,
} from "./balance.ts";
import { GRID_CELL_COUNT } from "./spatial.ts";
import type {
  Effect,
  Enemy,
  GameState,
  Gem,
  HitMark,
  PassiveId,
  Projectile,
  UpgradeId,
  WeaponId,
  WeaponState,
} from "./types.ts";

/** Mémoire d'un projectile : assez pour la poignée d'ennemis qu'il chevauche au même instant. */
const RECENT_HITS = 8;

function createEnemy(): Enemy {
  return {
    isActive: false,
    kind: "drifter",
    isElite: false,
    x: 0,
    y: 0,
    hp: 0,
    maxHp: 0,
    radius: 0,
    speed: 0,
    damage: 0,
    flashTimer: 0,
    stage: "chase",
    stageTimer: 0,
    dashX: 0,
    dashY: 0,
    pushX: 0,
    pushY: 0,
    summonTimer: 0,
  };
}

function createProjectile(): Projectile {
  return {
    isActive: false,
    kind: "spark",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    radius: 0,
    pierce: 0,
    secondsLeft: 0,
    recentHits: new Int16Array(RECENT_HITS),
    hitCursor: 0,
  };
}

function createGem(): Gem {
  return { isActive: false, x: 0, y: 0, value: 0, isAttracted: false };
}

function createEffect(): Effect {
  return { isActive: false, kind: "burst", x: 0, y: 0, radius: 0, age: 0 };
}

function createHitMark(): HitMark {
  return { isActive: false, x: 0, y: 0, amount: 0, age: 0, isKill: false };
}

function createWeapons(): Record<WeaponId, WeaponState> {
  const entries = WEAPON_IDS.map((id): [WeaponId, WeaponState] => [id, { level: 0, cooldown: 0, angle: 0, effectAge: 9 }]);
  const weapons = Object.fromEntries(entries) as Record<WeaponId, WeaponState>;
  weapons[STARTING_WEAPON].level = 1;
  return weapons;
}

/**
 * Nouvelle partie. `seed` fixe tout le hasard de la nuit ; `unlocked` liste les armes et passifs
 * débloqués entre les parties (ils entrent dans le tirage des améliorations).
 */
export function createGame(seed: number, unlocked: readonly UpgradeId[] = []): GameState {
  return {
    phase: "playing",
    time: 0,
    rngState: seed | 0,
    player: { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, hp: PLAYER.maxHp, hurtTimer: 0, level: 1, xp: 0, xpToNext: XP_BASE },
    stats: {
      maxHp: PLAYER.maxHp,
      moveSpeed: PLAYER.speed,
      pickupRadius: PLAYER.pickupRadius,
      damageMultiplier: 1,
      cooldownMultiplier: 1,
      regenPerSecond: 0,
      damageTakenMultiplier: 1,
      xpMultiplier: 1,
    },
    weapons: createWeapons(),
    passives: Object.fromEntries(PASSIVE_IDS.map((id) => [id, 0])) as Record<PassiveId, number>,
    unlocked: [...unlocked],
    enemies: Array.from({ length: MAX_ENEMIES }, createEnemy),
    projectiles: Array.from({ length: MAX_PROJECTILES }, createProjectile),
    gems: Array.from({ length: MAX_GEMS }, createGem),
    effects: Array.from({ length: MAX_EFFECTS }, createEffect),
    hitMarks: Array.from({ length: MAX_HIT_MARKS }, createHitMark),
    hitMarkCursor: 0,
    grid: {
      heads: new Int16Array(GRID_CELL_COUNT),
      next: new Int16Array(MAX_ENEMIES),
      nearby: new Int16Array(MAX_ENEMIES),
    },
    enemyCount: 0,
    spawnBudget: 0,
    eliteTimer: ELITE.firstAt,
    isBossSpawned: false,
    isBossDefeated: false,
    pendingLevelUps: 0,
    choices: [],
    kills: 0,
    elitesKilled: 0,
    killPoints: 0,
    shakeTimer: 0,
  };
}

/** Première place libre d'une réserve, ou `null` si elle est pleine (l'appelant renonce alors). */
export function takeFree<Pooled extends { isActive: boolean }>(pool: readonly Pooled[]): Pooled | null {
  for (const candidate of pool) {
    if (!candidate.isActive) {
      return candidate;
    }
  }
  return null;
}
