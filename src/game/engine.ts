import { COUNTDOWN_SECONDS, EARLY_BONUS_PER_SECOND, ENEMY_STATS, START_LIVES, START_MONEY, STEP_SECONDS } from "./balance.ts";
import { PATH_LENGTH, cellCenter, pointAlongPath, type Point } from "./grid.ts";
import { towerStat } from "./towers.ts";
import type { Enemy, GameEvent, GameState, Tower } from "./types.ts";
import { enemyKindAt, enemyMaxHp, spawnInterval, waveSize } from "./waves.ts";

/** Partie neuve : la vague 1 attend un clic. */
export function createGame(): GameState {
  return {
    phase: "ready",
    wave: 0,
    lives: START_LIVES,
    money: START_MONEY,
    towers: [],
    enemies: [],
    spawnedCount: 0,
    spawnTimer: 0,
    countdown: 0,
    nextId: 1,
  };
}

/** Vrai si « Vague suivante » peut être déclenchée : avant la vague 1 ou pendant le compte à rebours. */
export function canStartWave(state: GameState): boolean {
  return state.phase === "ready" || state.phase === "countdown";
}

/** Bonus offert si on lance la vague maintenant : seules les secondes entières restantes comptent. */
export function earlyBonus(state: GameState): number {
  if (state.phase !== "countdown") {
    return 0;
  }
  return Math.floor(state.countdown) * EARLY_BONUS_PER_SECOND;
}

/** Lance la vague suivante (clic du joueur ou fin du compte à rebours) et verse le bonus d'avance. */
export function startNextWave(state: GameState): GameEvent[] {
  if (!canStartWave(state)) {
    return [];
  }
  const bonus = earlyBonus(state);
  state.money += bonus;
  state.wave += 1;
  state.phase = "wave";
  state.spawnedCount = 0;
  state.spawnTimer = 0;
  state.countdown = 0;
  return [{ type: "waveStarted", wave: state.wave, bonus }];
}

/** Avance la partie d'un pas fixe (STEP_SECONDS) et renvoie ce qui s'est passé. */
export function step(state: GameState): GameEvent[] {
  if (state.phase === "countdown") {
    return tickCountdown(state);
  }
  if (state.phase !== "wave") {
    return [];
  }
  const events: GameEvent[] = [];
  spawnEnemies(state);
  moveEnemies(state, events);
  if (state.phase === "wave") {
    fireTowers(state, events);
    finishWaveIfCleared(state, events);
  }
  return events;
}

function tickCountdown(state: GameState): GameEvent[] {
  state.countdown -= STEP_SECONDS;
  if (state.countdown > 0) {
    return [];
  }
  state.countdown = 0;
  return startNextWave(state);
}

function spawnEnemies(state: GameState): void {
  const size = waveSize(state.wave);
  if (state.spawnedCount >= size) {
    return;
  }
  state.spawnTimer -= STEP_SECONDS;
  while (state.spawnedCount < size && state.spawnTimer <= 0) {
    const kind = enemyKindAt(state.wave, state.spawnedCount);
    const maxHp = enemyMaxHp(kind, state.wave);
    state.enemies.push({ id: state.nextId, kind, hp: maxHp, maxHp, distance: 0 });
    state.nextId += 1;
    state.spawnedCount += 1;
    state.spawnTimer += spawnInterval(state.wave);
  }
}

function moveEnemies(state: GameState, events: GameEvent[]): void {
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    const stats = ENEMY_STATS[enemy.kind];
    enemy.distance += stats.speed * STEP_SECONDS;
    if (enemy.distance < PATH_LENGTH) {
      survivors.push(enemy);
      continue;
    }
    state.lives = Math.max(state.lives - stats.livesLost, 0);
    events.push({ type: "leaked", kind: enemy.kind, livesLost: stats.livesLost });
  }
  state.enemies = survivors;
  if (state.lives === 0) {
    state.phase = "over";
    events.push({ type: "gameOver", wave: state.wave });
  }
}

/** Ennemi vivant et sa position, calculée une seule fois par pas pour toutes les tourelles. */
interface Target {
  readonly enemy: Enemy;
  readonly at: Point;
}

function fireTowers(state: GameState, events: GameEvent[]): void {
  const targets: Target[] = state.enemies.map((enemy) => ({ enemy, at: pointAlongPath(enemy.distance) }));
  for (const tower of state.towers) {
    tower.cooldown = Math.max(tower.cooldown - STEP_SECONDS, 0);
    if (tower.cooldown > 0) {
      continue;
    }
    const origin = cellCenter(tower);
    const target = findTarget(tower, origin, targets);
    if (target === undefined) {
      continue;
    }
    tower.cooldown = 1 / towerStat(tower, "rate");
    events.push({ type: "shot", towerId: tower.id, from: origin, to: target.at });
    target.enemy.hp -= towerStat(tower, "damage");
    if (target.enemy.hp <= 0) {
      const bounty = ENEMY_STATS[target.enemy.kind].bounty;
      state.money += bounty;
      events.push({ type: "killed", kind: target.enemy.kind, at: target.at, bounty });
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

/** Cible d'une tourelle : l'ennemi vivant à portée le plus avancé sur le chemin. */
function findTarget(tower: Tower, origin: Point, targets: readonly Target[]): Target | undefined {
  const range = towerStat(tower, "range");
  let best: Target | undefined;
  for (const target of targets) {
    const isAlive = target.enemy.hp > 0;
    const isInRange = Math.hypot(target.at.x - origin.x, target.at.y - origin.y) <= range;
    if (isAlive && isInRange && (best === undefined || target.enemy.distance > best.enemy.distance)) {
      best = target;
    }
  }
  return best;
}

function finishWaveIfCleared(state: GameState, events: GameEvent[]): void {
  if (state.spawnedCount < waveSize(state.wave) || state.enemies.length > 0) {
    return;
  }
  state.phase = "countdown";
  state.countdown = COUNTDOWN_SECONDS;
  events.push({ type: "waveCleared", wave: state.wave });
}
