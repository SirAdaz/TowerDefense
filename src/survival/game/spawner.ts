import { ARENA_HEIGHT, ARENA_WIDTH, BOSS, ELITE, MAX_ENEMIES, RUN_SECONDS, SPAWN, SPAWN_MIX } from "./balance.ts";
import { promoteToElite, rampMinutes, spawnEnemy } from "./enemies.ts";
import { nextIndex, nextRandom } from "./rng.ts";
import type { Enemy, EnemyKind, GameState } from "./types.ts";

/** Places gardées pour le boss et ses renforts : la horde ne remplit jamais toute la réserve. */
const RESERVED_SLOTS = 24;
/** Retard maximal rattrapé quand l'arène est pleine : pas de raz-de-marée dès qu'une place se libère. */
const MAX_BACKLOG = 6;
const GROUP_SPREAD = 46;

/** Ennemis par seconde à un instant de la nuit (rampe douce au début, voir `rampMinutes`). */
export function spawnRate(time: number): number {
  return SPAWN.baseRate + SPAWN.ratePerMinute * rampMinutes(Math.min(time, RUN_SECONDS));
}

interface MixEntry {
  readonly fromMinute: number;
  readonly kinds: ReadonlyArray<readonly [EnemyKind, number]>;
  readonly total: number;
}

/** Compositions préparées une fois : le tirage d'un ennemi ne crée aucun objet. */
const MIX_TABLE: readonly MixEntry[] = SPAWN_MIX.map((mix) => {
  const kinds = Object.entries(mix.weights) as Array<[EnemyKind, number]>;
  return { fromMinute: mix.fromMinute, kinds, total: kinds.reduce((sum, [, weight]) => sum + weight, 0) };
});

function currentMix(time: number): MixEntry | undefined {
  const minute = time / 60;
  let current = MIX_TABLE[0];
  for (const mix of MIX_TABLE) {
    if (mix.fromMinute <= minute) {
      current = mix;
    }
  }
  return current;
}

/** Tire un type d'ennemi selon la composition du moment. */
export function pickKind(state: GameState): EnemyKind {
  const mix = currentMix(state.time);
  let roll = nextRandom(state) * (mix?.total ?? 0);
  for (const [kind, weight] of mix?.kinds ?? []) {
    roll -= weight;
    if (roll < 0) {
      return kind;
    }
  }
  return "drifter";
}

/** Fait entrer un groupe par un point au hasard du pourtour, juste hors de l'arène. */
function spawnAtEdge(state: GameState, kind: EnemyKind, count: number): Enemy | null {
  const side = nextIndex(state, 4);
  const along = nextRandom(state);
  const isHorizontalEdge = side < 2;
  const farX = side === 2 ? -SPAWN.margin : ARENA_WIDTH + SPAWN.margin;
  const farY = side === 0 ? -SPAWN.margin : ARENA_HEIGHT + SPAWN.margin;
  const edgeX = isHorizontalEdge ? along * ARENA_WIDTH : farX;
  const edgeY = isHorizontalEdge ? farY : along * ARENA_HEIGHT;
  let lastSpawned: Enemy | null = null;
  for (let index = 0; index < count; index++) {
    const jitterX = (nextRandom(state) - 0.5) * GROUP_SPREAD;
    const jitterY = (nextRandom(state) - 0.5) * GROUP_SPREAD;
    lastSpawned = spawnEnemy(state, kind, edgeX + jitterX, edgeY + jitterY);
  }
  return lastSpawned;
}

function spawnElite(state: GameState, stepSeconds: number): void {
  state.eliteTimer -= stepSeconds;
  if (state.eliteTimer > 0) {
    return;
  }
  state.eliteTimer += ELITE.everySeconds;
  const elite = spawnAtEdge(state, pickKind(state), 1);
  if (elite !== null) {
    promoteToElite(elite);
  }
}

/**
 * Directeur des arrivées : un flux d'ennemis qui grossit avec les minutes, un élite à intervalle
 * fixe, puis le boss à la fin de la nuit (le flux ralentit alors, il ne s'arrête pas).
 */
export function updateSpawns(state: GameState, stepSeconds: number): void {
  if (!state.isBossSpawned && state.time >= RUN_SECONDS) {
    state.isBossSpawned = true;
    spawnEnemy(state, "boss", ARENA_WIDTH / 2, -SPAWN.margin);
  }
  if (!state.isBossSpawned) {
    spawnElite(state, stepSeconds);
  }
  const rateFactor = state.isBossSpawned ? BOSS.spawnRateFactor : 1;
  state.spawnBudget = Math.min(state.spawnBudget + spawnRate(state.time) * rateFactor * stepSeconds, MAX_BACKLOG);
  while (state.spawnBudget >= 1 && state.enemyCount < MAX_ENEMIES - RESERVED_SLOTS) {
    const kind = pickKind(state);
    const count = kind === "swarmer" ? SPAWN.swarmSize : 1;
    spawnAtEdge(state, kind, count);
    state.spawnBudget -= count;
  }
}
