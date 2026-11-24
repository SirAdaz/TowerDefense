import { BALANCE } from "./balance.ts";
import { createGame } from "./game.ts";
import { isBuildable } from "./towers.ts";
import { GAUGES, type GameState, type GaugeLevels, type Tower } from "./types.ts";

/** Sous-ensemble de Storage utilisé ici : localStorage dans le navigateur, une Map dans les tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = "tower-defense.save.v1";
export const RECORD_KEY = "tower-defense.record.v1";

interface SavedTower {
  col: number;
  row: number;
  levels: GaugeLevels;
  spent: number;
  kills: number;
}

/** Ce qui est sauvegardé : l'état entre deux vagues (jamais les ennemis en route). */
export interface SaveData {
  version: 1;
  wave: number;
  lives: number;
  money: number;
  towers: SavedTower[];
}

/** Photo de la partie à sauvegarder. Appelée seulement entre deux vagues : une vague en cours n'est pas sauvée. */
export function toSaveData(state: GameState): SaveData {
  const towers = state.towers.map(({ col, row, levels, spent, kills }) => ({ col, row, levels: { ...levels }, spent, kills }));
  return { version: 1, wave: state.wave, lives: state.lives, money: state.money, towers };
}

function isWholeNumber(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isValidLevels(value: unknown): value is GaugeLevels {
  if (typeof value !== "object" || value === null) return false;
  const levels = value as Record<string, unknown>;
  return GAUGES.every((gauge) => isWholeNumber(levels[gauge], 1, BALANCE.maxLevel));
}

function isValidTower(value: unknown): value is SavedTower {
  if (typeof value !== "object" || value === null) return false;
  const tower = value as Record<string, unknown>;
  return (
    isWholeNumber(tower.col, 0) &&
    isWholeNumber(tower.row, 0) &&
    isValidLevels(tower.levels) &&
    isWholeNumber(tower.spent, 0) &&
    isWholeNumber(tower.kills, 0)
  );
}

function isValidSave(value: unknown): value is SaveData {
  if (typeof value !== "object" || value === null) return false;
  const save = value as Record<string, unknown>;
  return (
    save.version === 1 &&
    isWholeNumber(save.wave, 0) &&
    isWholeNumber(save.lives, 1, BALANCE.startingLives) &&
    isWholeNumber(save.money, 0) &&
    Array.isArray(save.towers) &&
    save.towers.every(isValidTower)
  );
}

function restoreTowers(state: GameState, towers: readonly SavedTower[]): void {
  for (const saved of towers) {
    if (!isBuildable(state, saved)) continue;
    const tower: Tower = { id: state.nextId++, ...saved, levels: { ...saved.levels }, cooldown: 0 };
    state.towers.push(tower);
  }
}

/**
 * Reconstruit une partie depuis le texte sauvegardé. null si le texte est absent, illisible ou
 * incohérent (version inconnue, valeurs hors bornes) : on repart alors d'une partie neuve plutôt
 * que de planter. Une tourelle sur une case interdite ou déjà prise est ignorée.
 */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isValidSave(parsed)) return null;
  const state = createGame();
  state.wave = parsed.wave;
  state.lives = parsed.lives;
  state.money = parsed.money;
  state.intermissionLeft = parsed.wave === 0 ? null : BALANCE.intermissionSeconds;
  restoreTowers(state, parsed.towers);
  return state;
}

/** Écrit la sauvegarde, ou l'efface si la partie est perdue. Les erreurs du stockage (plein, interdit) sont ignorées : le jeu continue sans sauvegarde. */
export function writeSave(store: KeyValueStore, state: GameState): boolean {
  try {
    if (state.phase === "gameOver") store.removeItem(SAVE_KEY);
    else store.setItem(SAVE_KEY, JSON.stringify(toSaveData(state)));
    return true;
  } catch {
    return false;
  }
}

export function readSave(store: KeyValueStore): GameState | null {
  try {
    return parseSave(store.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** Efface la sauvegarde (nouvelle partie). Faux si le stockage refuse : la partie neuve démarre quand même. */
export function clearSave(store: KeyValueStore): boolean {
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Meilleure vague atteinte (0 si aucune ou illisible). */
export function readRecord(store: KeyValueStore): number {
  try {
    const record = Number(store.getItem(RECORD_KEY));
    return isWholeNumber(record, 0) ? record : 0;
  } catch {
    return 0;
  }
}

/** Enregistre `wave` si elle bat le record. Renvoie le record à jour. */
export function updateRecord(store: KeyValueStore, wave: number): number {
  const record = readRecord(store);
  if (wave <= record) return record;
  try {
    store.setItem(RECORD_KEY, String(wave));
  } catch {
    return wave;
  }
  return wave;
}
