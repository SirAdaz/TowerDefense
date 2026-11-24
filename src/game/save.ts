import { COUNTDOWN_SECONDS, ENEMY_KINDS, GAUGES, MAX_LEVEL, START_LIVES } from "./balance.ts";
import { PATH_LENGTH, cellKey, isInsideGrid, isOnPath } from "./grid.ts";
import type { Enemy, GameState, Phase, Tower } from "./types.ts";
import { waveSize } from "./waves.ts";

/** Stockage clé-valeur minimal : `localStorage` dans le navigateur, une `Map` dans les tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Ce qui est écrit sur le disque : l'état complet de la partie et le réglage de vitesse. */
export interface Snapshot {
  readonly state: GameState;
  readonly isFast: boolean;
}

export const SAVE_KEY = "towerdefense.snapshot.v1";
export const RECORD_KEY = "towerdefense.best-wave.v1";

const SAVE_VERSION = 1;
/** Une partie perdue n'est jamais sauvegardée : `over` n'est pas une phase valide à la lecture. */
const SAVED_PHASES: readonly Phase[] = ["ready", "wave", "countdown"];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isAmount(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

function isLevel(value: unknown): boolean {
  return isCount(value) && value >= 1 && value <= MAX_LEVEL;
}

function isTower(value: unknown): value is Tower {
  if (!isRecord(value) || !isRecord(value.levels)) {
    return false;
  }
  const { col, row, levels } = value;
  if (!isCount(value.id) || !isCount(col) || !isCount(row) || !isAmount(value.cooldown, 1)) {
    return false;
  }
  const cell = { col, row };
  return isInsideGrid(cell) && !isOnPath(cell) && GAUGES.every((gauge) => isLevel(levels[gauge]));
}

function isEnemy(value: unknown): value is Enemy {
  if (!isRecord(value) || !isCount(value.id)) {
    return false;
  }
  const isKnownKind = ENEMY_KINDS.some((kind) => kind === value.kind);
  const hasValidHp = isAmount(value.maxHp, Number.MAX_SAFE_INTEGER) && isAmount(value.hp, value.maxHp) && value.hp > 0;
  return isKnownKind && hasValidHp && isAmount(value.distance, PATH_LENGTH);
}

function hasValidCounters(value: UnknownRecord): boolean {
  return (
    SAVED_PHASES.some((phase) => phase === value.phase) &&
    isCount(value.wave) &&
    isCount(value.lives) &&
    value.lives >= 1 &&
    value.lives <= START_LIVES &&
    isCount(value.money) &&
    isCount(value.nextId) &&
    isAmount(value.countdown, COUNTDOWN_SECONDS)
  );
}

function hasValidEntities(value: UnknownRecord): boolean {
  const { towers, enemies } = value;
  if (!Array.isArray(towers) || !Array.isArray(enemies) || !towers.every(isTower) || !enemies.every(isEnemy)) {
    return false;
  }
  const occupiedCells = new Set(towers.map(cellKey));
  return occupiedCells.size === towers.length;
}

/** Cohérence entre les champs : une sauvegarde modifiée à la main ne doit pas donner une partie impossible. */
function isConsistent(state: GameState): boolean {
  const hasWaveStarted = state.wave >= 1;
  if (state.phase === "ready") {
    return !hasWaveStarted && state.enemies.length === 0;
  }
  const isSpawnPossible = state.spawnedCount <= waveSize(state.wave) && state.enemies.length <= state.spawnedCount;
  if (state.phase === "countdown") {
    return hasWaveStarted && state.enemies.length === 0;
  }
  return hasWaveStarted && isSpawnPossible;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !hasValidCounters(value) || !hasValidEntities(value)) {
    return false;
  }
  const hasValidSpawn = isCount(value.spawnedCount) && typeof value.spawnTimer === "number" && Math.abs(value.spawnTimer) <= 1;
  return hasValidSpawn && isConsistent(value as unknown as GameState);
}

/** Lit une sauvegarde. Renvoie `null` si elle est absente, illisible ou incohérente : on repart alors à neuf. */
export function parseSnapshot(text: string | null): Snapshot | null {
  if (text === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== SAVE_VERSION || !isGameState(parsed.state)) {
    return null;
  }
  return { state: parsed.state, isFast: parsed.isFast === true };
}

/** Écrit la partie. Renvoie faux si le stockage refuse (navigation privée, quota) : le jeu continue sans. */
export function saveSnapshot(store: KeyValueStore, snapshot: Snapshot): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...snapshot }));
    return true;
  } catch {
    return false;
  }
}

/** Charge la partie sauvegardée, ou `null` s'il n'y en a pas de valide. */
export function loadSnapshot(store: KeyValueStore): Snapshot | null {
  try {
    return parseSnapshot(store.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** Efface la partie sauvegardée (défaite ou nouvelle partie). Le record n'est pas touché. */
export function clearSnapshot(store: KeyValueStore): boolean {
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Record : meilleure vague atteinte, 0 si aucun ou si la valeur stockée est invalide. */
export function readRecord(store: KeyValueStore): number {
  try {
    const stored = Number(store.getItem(RECORD_KEY));
    return isCount(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

/** Enregistre la vague atteinte si elle bat le record. Renvoie le record à jour. */
export function updateRecord(store: KeyValueStore, wave: number): number {
  const record = readRecord(store);
  if (wave <= record) {
    return record;
  }
  try {
    store.setItem(RECORD_KEY, String(wave));
  } catch {
    return wave;
  }
  return wave;
}
