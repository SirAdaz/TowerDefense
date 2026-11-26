import type { KeyValueStore } from "../../shared/storage.ts";
import { toPlayerView } from "./evaluation.ts";
import type { EngineLine } from "./types.ts";

export type OpponentLevelId = "beginner" | "easy" | "medium" | "strong";

/**
 * Force de l'adversaire quand on joue une position contre le moteur. Le moteur cherche peu
 * profond, regarde plusieurs coups (`multiPv`) et n'en joue pas toujours le meilleur : il en tire un
 * au hasard parmi ceux qui ne perdent pas plus de `maxLossCp` centipions, sauf dans `bestShare` des
 * cas où il joue son meilleur coup.
 */
export interface OpponentLevel {
  readonly id: OpponentLevelId;
  readonly name: string;
  readonly depth: number;
  readonly multiPv: number;
  readonly bestShare: number;
  readonly maxLossCp: number;
}

/** Durée de réflexion de l'adversaire, quel que soit le niveau : la partie garde un bon rythme. */
export const OPPONENT_MOVE_TIME_MS = 400;

/** Niveau par défaut : un adversaire qui défend, mais laisse parfois une pièce, comme vers 600-800 Elo. */
const EASY: OpponentLevel = { id: "easy", name: "Facile", depth: 6, multiPv: 4, bestShare: 0.5, maxLossCp: 200 };

export const OPPONENT_LEVELS: readonly OpponentLevel[] = [
  { id: "beginner", name: "Débutant", depth: 4, multiPv: 5, bestShare: 0.3, maxLossCp: 400 },
  EASY,
  { id: "medium", name: "Moyen", depth: 8, multiPv: 3, bestShare: 0.7, maxLossCp: 80 },
  { id: "strong", name: "Fort", depth: 14, multiPv: 1, bestShare: 1, maxLossCp: 0 },
];

export const DEFAULT_LEVEL_ID: OpponentLevelId = EASY.id;

/** Choix du niveau, gardé dans le navigateur. */
export const LEVEL_KEY = "echecs.opponentLevel.v1";

export function levelById(id: string | null): OpponentLevel {
  return OPPONENT_LEVELS.find((level) => level.id === id) ?? EASY;
}

export function loadLevel(store: KeyValueStore): OpponentLevel {
  try {
    return levelById(store.getItem(LEVEL_KEY));
  } catch {
    return levelById(null);
  }
}

/** Renvoie faux si le navigateur a refusé de garder le choix. */
export function saveLevel(store: KeyValueStore, id: OpponentLevelId): boolean {
  try {
    store.setItem(LEVEL_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Coup de l'adversaire parmi les variantes du moteur (la meilleure en premier, évaluées pour lui).
 * `roll` est un tirage entre 0 et 1 (fourni par l'appelant : la logique reste pure). `null` sans variante.
 */
export function pickReply(lines: readonly EngineLine[], level: OpponentLevel, roll: number): string | null {
  const best = lines[0];
  if (best === undefined) {
    return null;
  }
  if (roll < level.bestShare || level.bestShare >= 1) {
    return best.moveUci;
  }
  const bestCp = toPlayerView(best.score, true).cp;
  const candidates = lines.filter((line) => bestCp - toPlayerView(line.score, true).cp <= level.maxLossCp);
  const share = (roll - level.bestShare) / (1 - level.bestShare);
  const index = Math.min(candidates.length - 1, Math.floor(share * candidates.length));
  return candidates[index]?.moveUci ?? best.moveUci;
}
