import { BOSS, COINS, RUN_SECONDS, SCORE, STEP_SECONDS } from "./balance.ts";
import { updateEffects } from "./combat.ts";
import { separateEnemies, updateEnemies } from "./enemies.ts";
import { updateGems } from "./gems.ts";
import { movePlayer, tickPlayer } from "./player.ts";
import { updateProjectiles } from "./projectiles.ts";
import { rebuildGrid } from "./spatial.ts";
import { updateSpawns } from "./spawner.ts";
import type { GameState, PlayerInput } from "./types.ts";
import { openLevelUp } from "./upgrades.ts";
import { updateWeapons } from "./weapons.ts";

function settlePhase(state: GameState): void {
  if (state.player.hp <= 0) {
    state.phase = "lost";
  } else if (state.isBossDefeated) {
    state.phase = "won";
  } else {
    openLevelUp(state);
  }
}

/**
 * Avance la partie d'un pas fixe de 1/60 s vers le point visé par le joueur. Rien ne bouge hors de
 * la phase `playing` (choix d'amélioration en attente, partie finie). Aucun objet n'est créé ici :
 * tout vit dans les réserves de l'état.
 */
export function step(state: GameState, input: PlayerInput): void {
  if (state.phase !== "playing") {
    return;
  }
  state.time += STEP_SECONDS;
  tickPlayer(state, STEP_SECONDS);
  movePlayer(state, input, STEP_SECONDS);
  updateSpawns(state, STEP_SECONDS);
  updateEnemies(state, STEP_SECONDS);
  rebuildGrid(state);
  separateEnemies(state);
  updateWeapons(state, STEP_SECONDS);
  updateProjectiles(state, STEP_SECONDS);
  updateGems(state, STEP_SECONDS);
  updateEffects(state, STEP_SECONDS);
  settlePhase(state);
}

/** Le joueur met fin à la partie : elle est comptée comme perdue, avec son score et ses pièces. */
export function abandon(state: GameState): void {
  if (state.phase === "playing" || state.phase === "levelUp") {
    state.phase = "lost";
  }
}

/** Secondes tenues, plafonnées à la durée de la nuit (le combat contre le boss ne rapporte pas de temps). */
export function survivedSeconds(state: GameState): number {
  return Math.floor(Math.min(state.time, RUN_SECONDS));
}

/** Score : ennemis détruits + temps tenu + prime du boss. */
export function finalScore(state: GameState): number {
  const bossPoints = state.isBossDefeated ? BOSS.points : 0;
  return state.killPoints + survivedSeconds(state) * SCORE.perSecond + bossPoints;
}

/** Pièces gagnées par la partie, gagnée ou perdue : elles ne servent qu'aux déblocages. */
export function coinsEarned(state: GameState): number {
  const victoryCoins = state.isBossDefeated ? COINS.forVictory : 0;
  return Math.floor(survivedSeconds(state) / COINS.secondsPerCoin) + state.elitesKilled * COINS.perElite + victoryCoins;
}
