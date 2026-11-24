import { BALANCE } from "./balance.ts";
import { fireTowers, moveEnemies, moveProjectiles } from "./combat.ts";
import type { GameState } from "./types.ts";
import { createEnemy, spawnInterval, waveComposition } from "./waves.ts";

/** Durée d'un pas de simulation : 60 pas par seconde de jeu, quelle que soit la fréquence d'affichage. */
export const STEP_SECONDS = 1 / 60;

/** Nouvelle partie : 20 vies, argent de départ, aucune tourelle ; la vague 1 attend le clic. */
export function createGame(): GameState {
  return {
    phase: "intermission",
    wave: 0,
    lives: BALANCE.startingLives,
    money: BALANCE.startingMoney,
    towers: [],
    enemies: [],
    projectiles: [],
    spawnQueue: [],
    spawnTimer: 0,
    intermissionLeft: null,
    nextId: 1,
  };
}

/**
 * Bonus du clic « Vague suivante » : 2 $ par seconde entière restante sur le compte à rebours.
 * 0 avant la vague 1 (pas de compte à rebours) et pendant une vague.
 */
export function earlyCallBonus(state: GameState): number {
  if (state.phase !== "intermission" || state.intermissionLeft === null) return 0;
  return Math.floor(state.intermissionLeft) * BALANCE.earlyCallBonusPerSecond;
}

/** Lance la vague suivante (clic ou fin du compte à rebours) et verse le bonus d'appel anticipé. Vrai si lancée. */
export function startNextWave(state: GameState): boolean {
  if (state.phase !== "intermission") return false;
  state.money += earlyCallBonus(state);
  state.wave += 1;
  state.phase = "wave";
  state.intermissionLeft = null;
  state.spawnQueue = waveComposition(state.wave);
  state.spawnTimer = 0;
  return true;
}

function spawnEnemies(state: GameState, seconds: number): void {
  state.spawnTimer -= seconds;
  if (state.spawnTimer > 0) return;
  const kind = state.spawnQueue.shift();
  if (!kind) return;
  state.enemies.push(createEnemy(kind, state.wave, state.nextId++));
  state.spawnTimer += spawnInterval(state.wave);
}

function finishWaveIfCleared(state: GameState): void {
  if (state.spawnQueue.length > 0 || state.enemies.length > 0) return;
  state.phase = "intermission";
  state.intermissionLeft = BALANCE.intermissionSeconds;
  state.projectiles = [];
}

function tickIntermission(state: GameState, seconds: number): void {
  if (state.intermissionLeft === null) return;
  state.intermissionLeft -= seconds;
  if (state.intermissionLeft <= 0) {
    state.intermissionLeft = 0;
    startNextWave(state);
  }
}

/**
 * Avance la partie d'un pas de `seconds` (en pratique STEP_SECONDS). Aucune horloge ni hasard :
 * la même suite de pas donne toujours le même résultat. Ne modifie que l'état reçu.
 */
export function step(state: GameState, seconds: number): void {
  if (state.phase === "gameOver") return;
  if (state.phase === "intermission") {
    tickIntermission(state, seconds);
    return;
  }
  spawnEnemies(state, seconds);
  moveEnemies(state, seconds);
  fireTowers(state, seconds);
  moveProjectiles(state, seconds);
  if (state.lives <= 0) {
    state.phase = "gameOver";
    return;
  }
  finishWaveIfCleared(state);
}
