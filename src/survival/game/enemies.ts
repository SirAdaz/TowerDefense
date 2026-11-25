import { ARENA_HEIGHT, ARENA_WIDTH, BOSS, CHARGE, ELITE, ENEMIES, PLAYER, SPAWN } from "./balance.ts";
import { hurtPlayer } from "./player.ts";
import { findEnemiesNear } from "./spatial.ts";
import { takeFree } from "./state.ts";
import type { Enemy, EnemyKind, GameState } from "./types.ts";

/** Jusqu'où un ennemi peut sortir de l'arène (une charge l'y emporte), avant d'y revenir. */
const OUTSIDE_LIMIT = 120;
/** Part du recul perdue par seconde. */
const PUSH_DAMPING = 5;
/** Part du chevauchement corrigée à chaque pas : les ennemis s'écartent sans à-coup. */
const SEPARATION_SHARE = 0.5;
const SUMMON_DISTANCE = 90;

/** Les ennemis sont plus résistants à chaque minute ; le boss a une vie fixe. */
export function enemyHpScale(time: number): number {
  return 1 + SPAWN.hpPerMinute * (time / 60);
}

/** Fait entrer un ennemi au point donné, ou renonce si la réserve est pleine. */
export function spawnEnemy(state: GameState, kind: EnemyKind, x: number, y: number): Enemy | null {
  const enemy = takeFree(state.enemies);
  if (enemy === null) {
    return null;
  }
  const stats = ENEMIES[kind];
  enemy.isActive = true;
  enemy.kind = kind;
  enemy.isElite = false;
  enemy.x = x;
  enemy.y = y;
  enemy.hp = kind === "boss" ? stats.hp : stats.hp * enemyHpScale(state.time);
  enemy.maxHp = enemy.hp;
  enemy.radius = stats.radius;
  enemy.speed = stats.speed;
  enemy.damage = stats.damage;
  enemy.flashTimer = 0;
  enemy.stage = "chase";
  enemy.stageTimer = CHARGE.restSeconds / 2;
  enemy.dashX = 0;
  enemy.dashY = 0;
  enemy.pushX = 0;
  enemy.pushY = 0;
  enemy.summonTimer = BOSS.summonEverySeconds;
  state.enemyCount += 1;
  return enemy;
}

/** Un élite : le même ennemi, plus gros et bien plus résistant, qui laisse un gros éclat. */
export function promoteToElite(enemy: Enemy): void {
  enemy.isElite = true;
  enemy.hp *= ELITE.hpFactor;
  enemy.maxHp = enemy.hp;
  enemy.radius *= ELITE.radiusFactor;
}

/** Fait avancer la charge : approche, arrêt qui l'annonce, ruée, puis repos. */
function advanceCharge(enemy: Enemy, distance: number, stepSeconds: number): void {
  enemy.stageTimer -= stepSeconds;
  if (enemy.stage === "chase") {
    if (enemy.stageTimer <= 0 && distance < CHARGE.range) {
      enemy.stage = "windup";
      enemy.stageTimer = CHARGE.windupSeconds;
    }
    return;
  }
  if (enemy.stageTimer > 0) {
    return;
  }
  if (enemy.stage === "windup") {
    enemy.stage = "dash";
    enemy.stageTimer = CHARGE.dashSeconds;
  } else {
    enemy.stage = "chase";
    enemy.stageTimer = CHARGE.restSeconds;
  }
}

function currentSpeed(enemy: Enemy): number {
  if (enemy.stage === "chase") {
    return enemy.speed;
  }
  return enemy.stage === "dash" ? ENEMIES[enemy.kind].dashSpeed : 0;
}

function moveEnemy(state: GameState, enemy: Enemy, stepSeconds: number): void {
  const offsetX = state.player.x - enemy.x;
  const offsetY = state.player.y - enemy.y;
  const distance = Math.hypot(offsetX, offsetY) || 1;
  if (enemy.stage === "chase") {
    // La direction se fige quand la charge se prépare : le joueur a le temps de s'écarter.
    enemy.dashX = offsetX / distance;
    enemy.dashY = offsetY / distance;
  }
  if (ENEMIES[enemy.kind].dashSpeed > 0) {
    advanceCharge(enemy, distance, stepSeconds);
  }
  const speed = currentSpeed(enemy);
  enemy.x += (enemy.dashX * speed + enemy.pushX) * stepSeconds;
  enemy.y += (enemy.dashY * speed + enemy.pushY) * stepSeconds;
  const damping = Math.max(1 - PUSH_DAMPING * stepSeconds, 0);
  enemy.pushX *= damping;
  enemy.pushY *= damping;
  enemy.x = Math.min(Math.max(enemy.x, -OUTSIDE_LIMIT), ARENA_WIDTH + OUTSIDE_LIMIT);
  enemy.y = Math.min(Math.max(enemy.y, -OUTSIDE_LIMIT), ARENA_HEIGHT + OUTSIDE_LIMIT);
}

function touchPlayer(state: GameState, enemy: Enemy): void {
  const reach = enemy.radius + PLAYER.radius;
  const offsetX = state.player.x - enemy.x;
  const offsetY = state.player.y - enemy.y;
  if (offsetX * offsetX + offsetY * offsetY < reach * reach) {
    hurtPlayer(state, enemy.damage);
  }
}

/** Le boss appelle régulièrement un cercle de petits ennemis rapides autour de lui. */
function summonSwarm(state: GameState, boss: Enemy, stepSeconds: number): void {
  boss.summonTimer -= stepSeconds;
  if (boss.summonTimer > 0) {
    return;
  }
  boss.summonTimer = BOSS.summonEverySeconds;
  for (let index = 0; index < BOSS.summonCount; index++) {
    const angle = (index / BOSS.summonCount) * Math.PI * 2;
    const distance = boss.radius + SUMMON_DISTANCE;
    spawnEnemy(state, "swarmer", boss.x + Math.cos(angle) * distance, boss.y + Math.sin(angle) * distance);
  }
}

/** Déplace chaque ennemi vers le joueur (ou le long de sa charge) et applique les dégâts de contact. */
export function updateEnemies(state: GameState, stepSeconds: number): void {
  for (const enemy of state.enemies) {
    if (!enemy.isActive) {
      continue;
    }
    enemy.flashTimer = Math.max(enemy.flashTimer - stepSeconds, 0);
    moveEnemy(state, enemy, stepSeconds);
    touchPlayer(state, enemy);
    if (enemy.kind === "boss") {
      summonSwarm(state, enemy, stepSeconds);
    }
  }
}

function pushApart(enemy: Enemy, other: Enemy): void {
  const offsetX = enemy.x - other.x;
  const offsetY = enemy.y - other.y;
  const minDistance = enemy.radius + other.radius;
  const squared = offsetX * offsetX + offsetY * offsetY;
  if (squared >= minDistance * minDistance || squared < 0.0001) {
    return;
  }
  const distance = Math.sqrt(squared);
  const correction = ((minDistance - distance) * SEPARATION_SHARE) / distance;
  enemy.x += offsetX * correction;
  enemy.y += offsetY * correction;
}

/** Écarte un ennemi de chacun de ses voisins. */
function separateFromNeighbours(state: GameState, enemy: Enemy, enemyIndex: number): void {
  const candidateCount = findEnemiesNear(state, enemy.x, enemy.y, enemy.radius);
  for (let slot = 0; slot < candidateCount; slot++) {
    const otherIndex = state.grid.nearby[slot] ?? -1;
    const other = state.enemies[otherIndex];
    if (other !== undefined && otherIndex !== enemyIndex && other.isActive) {
      pushApart(enemy, other);
    }
  }
}

/** Le boss et un ennemi en pleine charge gardent leur trajectoire. */
function isDeflectable(enemy: Enemy): boolean {
  return enemy.isActive && enemy.kind !== "boss" && enemy.stage !== "dash";
}

/**
 * Écarte les ennemis qui se chevauchent : la horde garde du volume au lieu de s'empiler en un
 * point. Grille à jour requise.
 */
export function separateEnemies(state: GameState): void {
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex++) {
    const enemy = state.enemies[enemyIndex];
    if (enemy !== undefined && isDeflectable(enemy)) {
      separateFromNeighbours(state, enemy, enemyIndex);
    }
  }
}
