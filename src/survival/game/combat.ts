import { ARENA_HEIGHT, ARENA_WIDTH, ELITE, ENEMIES } from "./balance.ts";
import { findEnemiesNear } from "./spatial.ts";
import { takeFree } from "./state.ts";
import type { Effect, Enemy, GameState } from "./types.ts";

/** Durée d'affichage d'un effet (anneau, éclair). */
export const EFFECT_SECONDS = 0.35;
const FLASH_SECONDS = 0.09;
/** Les éclats tombent toujours dans l'arène, même si l'ennemi meurt sur son bord. */
const GEM_INSET = 14;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Démarre un effet visuel ; rien si la réserve est pleine (un effet manquant ne change pas la partie). */
export function spawnEffect(state: GameState, kind: Effect["kind"], center: Point, radius: number): void {
  const effect = takeFree(state.effects);
  if (effect === null) {
    return;
  }
  effect.isActive = true;
  effect.kind = kind;
  effect.x = center.x;
  effect.y = center.y;
  effect.radius = radius;
  effect.age = 0;
}

export function updateEffects(state: GameState, stepSeconds: number): void {
  for (const effect of state.effects) {
    if (!effect.isActive) {
      continue;
    }
    effect.age += stepSeconds;
    effect.isActive = effect.age < EFFECT_SECONDS;
  }
}

/**
 * Pose un éclat d'expérience. Réserve pleine : sa valeur rejoint un éclat déjà au sol, aucune
 * expérience n'est perdue.
 */
export function dropGem(state: GameState, center: Point, value: number): void {
  const gem = takeFree(state.gems);
  if (gem === null) {
    const fullest = state.gems[0];
    if (fullest !== undefined) {
      fullest.value += value;
    }
    return;
  }
  gem.isActive = true;
  gem.isAttracted = false;
  gem.value = value;
  gem.x = Math.min(Math.max(center.x, GEM_INSET), ARENA_WIDTH - GEM_INSET);
  gem.y = Math.min(Math.max(center.y, GEM_INSET), ARENA_HEIGHT - GEM_INSET);
}

function killEnemy(state: GameState, enemy: Enemy): void {
  const stats = ENEMIES[enemy.kind];
  enemy.isActive = false;
  state.enemyCount -= 1;
  state.kills += 1;
  state.killPoints += stats.points * (enemy.isElite ? ELITE.pointsFactor : 1);
  const xp = stats.xp + (enemy.isElite ? ELITE.xp : 0);
  if (xp > 0) {
    dropGem(state, enemy, xp);
  }
  spawnEffect(state, "burst", enemy, enemy.radius);
  if (enemy.isElite) {
    state.elitesKilled += 1;
  }
  if (enemy.kind === "boss") {
    state.isBossDefeated = true;
  }
}

/** Retire de la vie à un ennemi et le détruit à zéro (éclat, points, effet). */
export function damageEnemy(state: GameState, enemy: Enemy, amount: number): void {
  enemy.hp -= amount;
  enemy.flashTimer = FLASH_SECONDS;
  if (enemy.hp <= 0) {
    killEnemy(state, enemy);
  }
}

/** Blesse tous les ennemis qui touchent le disque donné. Renvoie le nombre d'ennemis touchés. */
export function damageArea(state: GameState, center: Point, radius: number, amount: number): number {
  const candidateCount = findEnemiesNear(state, center.x, center.y, radius);
  let hitCount = 0;
  for (let slot = 0; slot < candidateCount; slot++) {
    const enemy = state.enemies[state.grid.nearby[slot] ?? -1];
    if (enemy === undefined || !enemy.isActive) {
      continue;
    }
    const reach = radius + enemy.radius;
    const offsetX = enemy.x - center.x;
    const offsetY = enemy.y - center.y;
    if (offsetX * offsetX + offsetY * offsetY <= reach * reach) {
      damageEnemy(state, enemy, amount);
      hitCount += 1;
    }
  }
  return hitCount;
}
