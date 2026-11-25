import { ARENA_HEIGHT, ARENA_WIDTH } from "./balance.ts";
import { damageEnemy } from "./combat.ts";
import { findEnemiesNear } from "./spatial.ts";
import type { Enemy, GameState, Projectile } from "./types.ts";

/** Un projectile s'éteint un peu après avoir quitté l'arène. */
const OUTSIDE_MARGIN = 60;

function isOutside(projectile: Projectile): boolean {
  return (
    projectile.x < -OUTSIDE_MARGIN ||
    projectile.x > ARENA_WIDTH + OUTSIDE_MARGIN ||
    projectile.y < -OUTSIDE_MARGIN ||
    projectile.y > ARENA_HEIGHT + OUTSIDE_MARGIN
  );
}

function isTouching(projectile: Projectile, enemy: Enemy): boolean {
  const reach = projectile.radius + enemy.radius;
  const offsetX = enemy.x - projectile.x;
  const offsetY = enemy.y - projectile.y;
  return offsetX * offsetX + offsetY * offsetY <= reach * reach;
}

/** Touche chaque ennemi au contact, une seule fois par projectile, jusqu'à épuiser sa perforation. */
function hitEnemies(state: GameState, projectile: Projectile): void {
  const candidateCount = findEnemiesNear(state, projectile.x, projectile.y, projectile.radius);
  for (let slot = 0; slot < candidateCount; slot++) {
    const enemyIndex = state.grid.nearby[slot] ?? -1;
    const enemy = state.enemies[enemyIndex];
    if (enemy === undefined || !enemy.isActive || projectile.recentHits.includes(enemyIndex)) {
      continue;
    }
    if (!isTouching(projectile, enemy)) {
      continue;
    }
    projectile.recentHits[projectile.hitCursor] = enemyIndex;
    projectile.hitCursor = (projectile.hitCursor + 1) % projectile.recentHits.length;
    damageEnemy(state, enemy, projectile.damage);
    projectile.pierce -= 1;
    if (projectile.pierce < 0) {
      projectile.isActive = false;
      return;
    }
  }
}

/** Avance les projectiles, les éteint en fin de course et applique leurs touchés. Grille à jour requise. */
export function updateProjectiles(state: GameState, stepSeconds: number): void {
  for (const projectile of state.projectiles) {
    if (!projectile.isActive) {
      continue;
    }
    projectile.x += projectile.vx * stepSeconds;
    projectile.y += projectile.vy * stepSeconds;
    projectile.secondsLeft -= stepSeconds;
    if (projectile.secondsLeft <= 0 || isOutside(projectile)) {
      projectile.isActive = false;
      continue;
    }
    hitEnemies(state, projectile);
  }
}
