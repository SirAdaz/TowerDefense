import { PLAYER } from "./balance.ts";
import { gainXp } from "./player.ts";
import type { GameState } from "./types.ts";

/**
 * Les éclats à portée de ramassage filent vers le joueur et lui donnent leur expérience en
 * l'atteignant. Un éclat attiré le reste : il ne se perd pas si le joueur s'éloigne.
 */
export function updateGems(state: GameState, stepSeconds: number): void {
  const { player, stats } = state;
  const travel = PLAYER.gemSpeed * stepSeconds;
  for (const gem of state.gems) {
    if (!gem.isActive) {
      continue;
    }
    const offsetX = player.x - gem.x;
    const offsetY = player.y - gem.y;
    const distance = Math.hypot(offsetX, offsetY);
    if (distance <= stats.pickupRadius) {
      gem.isAttracted = true;
    }
    if (!gem.isAttracted) {
      continue;
    }
    if (distance <= travel + PLAYER.radius) {
      gem.isActive = false;
      gainXp(state, gem.value);
      continue;
    }
    gem.x += (offsetX / distance) * travel;
    gem.y += (offsetY / distance) * travel;
  }
}
