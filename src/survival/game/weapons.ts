import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HALO_ORB_RADIUS,
  HALO_TURNS_PER_SECOND,
  LANCE_SECONDS,
  LANCE_SPEED,
  PULSE_PUSH,
  SPARK_SECONDS,
  SPARK_SPEED,
  WEAPONS,
  type WeaponLevel,
} from "./balance.ts";
import { damageArea, spawnEffect } from "./combat.ts";
import { nextIndex } from "./rng.ts";
import { findEnemiesNear } from "./spatial.ts";
import { takeFree } from "./state.ts";
import type { Enemy, GameState, ProjectileKind, WeaponId } from "./types.ts";

/** Écart entre deux traits d'une même salve d'étincelles, en radians. */
const SPARK_SPREAD = 0.16;
const PROJECTILE_SECONDS: Record<ProjectileKind, number> = { spark: SPARK_SECONDS, lance: LANCE_SECONDS };
const PROJECTILE_SPEED: Record<ProjectileKind, number> = { spark: SPARK_SPEED, lance: LANCE_SPEED };

/** Point de travail réutilisé pour les orbes du halo : aucun objet créé par image. */
const orbCenter = { x: 0, y: 0 };

/** Niveau courant d'une arme, ou `null` si le joueur ne l'a pas. */
export function weaponLevel(state: GameState, id: WeaponId): WeaponLevel | null {
  return WEAPONS[id].levels[state.weapons[id].level - 1] ?? null;
}

/** Ennemi vivant le plus proche du joueur, ou `null` si l'arène est vide. */
export function findNearestEnemy(state: GameState): Enemy | null {
  let nearest: Enemy | null = null;
  let nearestSquared = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.isActive) {
      continue;
    }
    const offsetX = enemy.x - state.player.x;
    const offsetY = enemy.y - state.player.y;
    const squared = offsetX * offsetX + offsetY * offsetY;
    if (squared < nearestSquared) {
      nearest = enemy;
      nearestSquared = squared;
    }
  }
  return nearest;
}

function fireProjectile(state: GameState, kind: ProjectileKind, angle: number, level: WeaponLevel): void {
  const projectile = takeFree(state.projectiles);
  if (projectile === null) {
    return;
  }
  projectile.isActive = true;
  projectile.kind = kind;
  projectile.x = state.player.x;
  projectile.y = state.player.y;
  projectile.vx = Math.cos(angle) * PROJECTILE_SPEED[kind];
  projectile.vy = Math.sin(angle) * PROJECTILE_SPEED[kind];
  projectile.damage = level.damage * state.stats.damageMultiplier;
  projectile.radius = level.area;
  projectile.pierce = level.pierce;
  projectile.secondsLeft = PROJECTILE_SECONDS[kind];
  projectile.recentHits.fill(-1);
  projectile.hitCursor = 0;
}

/**
 * Étincelle et comète : une salve vers l'ennemi le plus proche à chaque rechargement. Les traits
 * de l'étincelle partent en éventail, les comètes dans des directions opposées.
 */
function fireVolley(state: GameState, kind: ProjectileKind, stepSeconds: number): void {
  const weapon = state.weapons[kind];
  const level = weaponLevel(state, kind);
  if (level === null) {
    return;
  }
  weapon.cooldown -= stepSeconds;
  const target = weapon.cooldown <= 0 ? findNearestEnemy(state) : null;
  if (target === null) {
    return;
  }
  weapon.cooldown = level.cooldown * state.stats.cooldownMultiplier;
  const aim = Math.atan2(target.y - state.player.y, target.x - state.player.x);
  for (let index = 0; index < level.count; index++) {
    const offset = kind === "spark" ? (index - (level.count - 1) / 2) * SPARK_SPREAD : index * Math.PI;
    fireProjectile(state, kind, aim + offset, level);
  }
}

/** Halo : des orbes en orbite qui brûlent en continu ce qu'ils touchent (dégâts par seconde). */
function updateHalo(state: GameState, stepSeconds: number): void {
  const weapon = state.weapons.halo;
  const level = weaponLevel(state, "halo");
  if (level === null) {
    return;
  }
  weapon.angle = (weapon.angle + HALO_TURNS_PER_SECOND * Math.PI * 2 * stepSeconds) % (Math.PI * 2);
  const damage = level.damage * state.stats.damageMultiplier * stepSeconds;
  for (let index = 0; index < level.count; index++) {
    const angle = weapon.angle + (index / level.count) * Math.PI * 2;
    orbCenter.x = state.player.x + Math.cos(angle) * level.area;
    orbCenter.y = state.player.y + Math.sin(angle) * level.area;
    damageArea(state, orbCenter, HALO_ORB_RADIUS, damage);
  }
}

/** Repousse les ennemis pris dans l'onde. Le boss ne recule pas. */
function pushAway(state: GameState, radius: number): void {
  const { player } = state;
  const candidateCount = findEnemiesNear(state, player.x, player.y, radius);
  for (let slot = 0; slot < candidateCount; slot++) {
    const enemy = state.enemies[state.grid.nearby[slot] ?? -1];
    if (enemy === undefined || !enemy.isActive || enemy.kind === "boss") {
      continue;
    }
    const offsetX = enemy.x - player.x;
    const offsetY = enemy.y - player.y;
    const distance = Math.hypot(offsetX, offsetY) || 1;
    if (distance <= radius + enemy.radius) {
      enemy.pushX = (offsetX / distance) * PULSE_PUSH;
      enemy.pushY = (offsetY / distance) * PULSE_PUSH;
    }
  }
}

/** Onde : une détonation autour du joueur à chaque rechargement, qui blesse et repousse. */
function updatePulse(state: GameState, stepSeconds: number): void {
  const weapon = state.weapons.pulse;
  const level = weaponLevel(state, "pulse");
  if (level === null) {
    return;
  }
  weapon.effectAge += stepSeconds;
  weapon.cooldown -= stepSeconds;
  if (weapon.cooldown > 0) {
    return;
  }
  weapon.cooldown = level.cooldown * state.stats.cooldownMultiplier;
  weapon.effectAge = 0;
  damageArea(state, state.player, level.area, level.damage * state.stats.damageMultiplier);
  pushAway(state, level.area);
}

/** Ennemi vivant pris au hasard parmi ceux qui sont entrés dans l'arène. */
function pickRandomEnemy(state: GameState): Enemy | null {
  const poolSize = state.enemies.length;
  const start = nextIndex(state, poolSize);
  for (let offset = 0; offset < poolSize; offset++) {
    const enemy = state.enemies[(start + offset) % poolSize];
    const isInside =
      enemy !== undefined && enemy.x >= 0 && enemy.x <= ARENA_WIDTH && enemy.y >= 0 && enemy.y <= ARENA_HEIGHT;
    if (enemy !== undefined && enemy.isActive && isInside) {
      return enemy;
    }
  }
  return null;
}

/** Foudre : frappe des ennemis au hasard, où qu'ils soient, avec un petit impact de zone. */
function updateStorm(state: GameState, stepSeconds: number): void {
  const weapon = state.weapons.storm;
  const level = weaponLevel(state, "storm");
  if (level === null) {
    return;
  }
  weapon.cooldown -= stepSeconds;
  if (weapon.cooldown > 0) {
    return;
  }
  for (let index = 0; index < level.count; index++) {
    const target = pickRandomEnemy(state);
    if (target === null) {
      return;
    }
    weapon.cooldown = level.cooldown * state.stats.cooldownMultiplier;
    spawnEffect(state, "bolt", target, level.area);
    damageArea(state, target, level.area, level.damage * state.stats.damageMultiplier);
  }
}

/** Fait tirer toutes les armes possédées : le joueur ne déclenche rien lui-même. */
export function updateWeapons(state: GameState, stepSeconds: number): void {
  fireVolley(state, "spark", stepSeconds);
  fireVolley(state, "lance", stepSeconds);
  updateHalo(state, stepSeconds);
  updatePulse(state, stepSeconds);
  updateStorm(state, stepSeconds);
}
