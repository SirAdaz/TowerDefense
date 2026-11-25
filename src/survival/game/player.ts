import { ARENA_HEIGHT, ARENA_WIDTH, LEVEL_UP_HEAL, PASSIVE_BONUS, PLAYER, XP_BASE, XP_CURVE, XP_PER_LEVEL } from "./balance.ts";
import type { GameState, PlayerInput } from "./types.ts";

const HURT_SHAKE_SECONDS = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Expérience demandée pour passer du niveau donné au suivant. */
export function xpForLevel(level: number): number {
  const passed = level - 1;
  return Math.floor(XP_BASE + XP_PER_LEVEL * passed + XP_CURVE * passed * passed);
}

/**
 * Rapproche le personnage du point visé, à sa vitesse maximale : il suit le curseur sans jamais
 * s'y téléporter, et reste dans l'arène.
 */
export function movePlayer(state: GameState, input: PlayerInput, stepSeconds: number): void {
  const { player } = state;
  const offsetX = input.targetX - player.x;
  const offsetY = input.targetY - player.y;
  const distance = Math.hypot(offsetX, offsetY);
  const maxStep = state.stats.moveSpeed * stepSeconds;
  if (distance > maxStep) {
    player.x += (offsetX / distance) * maxStep;
    player.y += (offsetY / distance) * maxStep;
  } else {
    player.x = input.targetX;
    player.y = input.targetY;
  }
  player.x = clamp(player.x, PLAYER.radius, ARENA_WIDTH - PLAYER.radius);
  player.y = clamp(player.y, PLAYER.radius, ARENA_HEIGHT - PLAYER.radius);
}

/** Écoule l'invulnérabilité et applique la régénération. */
export function tickPlayer(state: GameState, stepSeconds: number): void {
  const { player, stats } = state;
  player.hurtTimer = Math.max(player.hurtTimer - stepSeconds, 0);
  state.shakeTimer = Math.max(state.shakeTimer - stepSeconds, 0);
  player.hp = Math.min(player.hp + stats.regenPerSecond * stepSeconds, stats.maxHp);
}

/** Coup reçu, ignoré pendant l'invulnérabilité qui suit le coup précédent. */
export function hurtPlayer(state: GameState, damage: number): void {
  const { player } = state;
  if (player.hurtTimer > 0) {
    return;
  }
  player.hp = Math.max(player.hp - damage * state.stats.damageTakenMultiplier, 0);
  player.hurtTimer = PLAYER.hurtCooldown;
  state.shakeTimer = HURT_SHAKE_SECONDS;
}

/** Ajoute de l'expérience ; chaque niveau franchi met un choix d'amélioration en attente. */
export function gainXp(state: GameState, amount: number): void {
  const { player } = state;
  player.xp += amount * state.stats.xpMultiplier;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = xpForLevel(player.level);
    state.pendingLevelUps += 1;
    player.hp = Math.min(player.hp + LEVEL_UP_HEAL, state.stats.maxHp);
  }
}

/** Recalcule les valeurs dérivées des passifs. À appeler après chaque amélioration choisie. */
export function recomputeStats(state: GameState): void {
  const { passives, stats } = state;
  stats.maxHp = PLAYER.maxHp + PASSIVE_BONUS.vigorHp * passives.vigor;
  stats.moveSpeed = PLAYER.speed * (1 + PASSIVE_BONUS.swiftness * passives.swiftness);
  stats.pickupRadius = PLAYER.pickupRadius * (1 + PASSIVE_BONUS.magnet * passives.magnet);
  stats.damageMultiplier = 1 + PASSIVE_BONUS.might * passives.might;
  stats.cooldownMultiplier = 1 - PASSIVE_BONUS.haste * passives.haste;
  stats.regenPerSecond = PASSIVE_BONUS.regen * passives.regen;
  stats.damageTakenMultiplier = 1 - PASSIVE_BONUS.armor * passives.armor;
  stats.xpMultiplier = 1 + PASSIVE_BONUS.wisdom * passives.wisdom;
}
