import { BALANCE } from "./balance.ts";
import { PATH_LENGTH, type Point, cellCenter, pointAlongPath } from "./grid.ts";
import { findTower, towerStats } from "./towers.ts";
import type { Enemy, GameState, Projectile, Tower } from "./types.ts";

/** Distance (en cases) sous laquelle un projectile touche sa cible. */
const HIT_DISTANCE = 0.15;

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Position d'un ennemi sur la carte, en coordonnées de grille. */
export function enemyPosition(enemy: Enemy): Point {
  return pointAlongPath(enemy.distance);
}

/**
 * Cible d'une tourelle : parmi les ennemis à portée, celui qui est le plus avancé sur le chemin
 * (le plus proche de la sortie). undefined si personne n'est à portée.
 */
export function pickTarget(tower: Tower, enemies: readonly Enemy[]): Enemy | undefined {
  const origin = cellCenter(tower);
  const { range } = towerStats(tower.levels);
  let best: Enemy | undefined;
  for (const enemy of enemies) {
    const isInRange = distanceBetween(origin, enemyPosition(enemy)) <= range;
    if (isInRange && (!best || enemy.distance > best.distance)) best = enemy;
  }
  return best;
}

/** Vies retirées quand cet ennemi atteint la sortie. */
function leakCost(enemy: Enemy): number {
  return enemy.kind === "boss" ? BALANCE.bossLeakLives : BALANCE.leakLives;
}

/** Fait avancer les ennemis ; ceux qui atteignent la sortie retirent des vies (5 pour un boss, 1 sinon) et quittent la carte. */
export function moveEnemies(state: GameState, seconds: number): void {
  const stillOnMap: Enemy[] = [];
  for (const enemy of state.enemies) {
    enemy.distance += enemy.speed * seconds;
    if (enemy.distance >= PATH_LENGTH) state.lives = Math.max(0, state.lives - leakCost(enemy));
    else stillOnMap.push(enemy);
  }
  state.enemies = stillOnMap;
}

/** Recharge les tourelles et tire sur la cible choisie par pickTarget quand le tir est prêt. */
export function fireTowers(state: GameState, seconds: number): void {
  for (const tower of state.towers) {
    tower.cooldown = Math.max(0, tower.cooldown - seconds);
    if (tower.cooldown > 0) continue;
    const target = pickTarget(tower, state.enemies);
    if (!target) continue;
    const { damage, fireRate } = towerStats(tower.levels);
    const origin = cellCenter(tower);
    state.projectiles.push({ id: state.nextId++, towerId: tower.id, targetId: target.id, damage, ...origin });
    tower.cooldown = 1 / fireRate;
  }
}

function applyHit(state: GameState, projectile: Projectile, target: Enemy): void {
  target.hp -= projectile.damage;
  if (target.hp > 0) return;
  state.money += target.reward;
  state.enemies = state.enemies.filter((enemy) => enemy.id !== target.id);
  const shooter = findTower(state, projectile.towerId);
  if (shooter) shooter.kills += 1;
}

/**
 * Fait voler les projectiles vers leur cible (tir à tête chercheuse). Un projectile dont la cible a
 * disparu (tuée ou sortie) se perd. Un ennemi tué rapporte sa prime.
 */
export function moveProjectiles(state: GameState, seconds: number): void {
  const inFlight: Projectile[] = [];
  const step = BALANCE.projectileSpeed * seconds;
  for (const projectile of state.projectiles) {
    const target = state.enemies.find((enemy) => enemy.id === projectile.targetId);
    if (!target) continue;
    const aim = enemyPosition(target);
    const remaining = distanceBetween(projectile, aim);
    if (remaining <= step + HIT_DISTANCE) {
      applyHit(state, projectile, target);
      continue;
    }
    projectile.x += ((aim.x - projectile.x) / remaining) * step;
    projectile.y += ((aim.y - projectile.y) / remaining) * step;
    inFlight.push(projectile);
  }
  state.projectiles = inFlight;
}
