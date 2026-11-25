import type { KeyValueStore } from "../../shared/storage.ts";
import { UNLOCKS } from "./balance.ts";
import { coinsEarned, finalScore, survivedSeconds } from "./engine.ts";
import type { GameState, UpgradeId } from "./types.ts";

/** Ce qui est gardé d'une partie à l'autre : le record, les pièces et les déblocages. Jamais de bonus de puissance. */
export interface Profile {
  readonly bestScore: number;
  /** Plus long temps tenu, en secondes (600 = nuit entière). */
  readonly bestSeconds: number;
  readonly hasWon: boolean;
  readonly coins: number;
  readonly unlocked: readonly UpgradeId[];
}

/** Bilan d'une partie finie, affiché sur l'écran de score. */
export interface RunSummary {
  readonly score: number;
  readonly seconds: number;
  readonly hasWon: boolean;
  readonly kills: number;
  readonly level: number;
  readonly coins: number;
  readonly isNewRecord: boolean;
}

export const PROFILE_KEY = "nuitblanche.profile.v1";

export function emptyProfile(): Profile {
  return { bestScore: 0, bestSeconds: 0, hasWon: false, coins: 0, unlocked: [] };
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readUnlocked(value: unknown): UpgradeId[] {
  const stored = Array.isArray(value) ? value : [];
  return UNLOCKS.map((unlock) => unlock.id).filter((id) => stored.includes(id));
}

/** Relit un profil stocké. Tout champ absent ou invalide retombe sur sa valeur de départ. */
export function parseProfile(text: string | null): Profile {
  if (text === null) {
    return emptyProfile();
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return emptyProfile();
    }
    const fields = parsed as Record<string, unknown>;
    return {
      bestScore: readCount(fields.bestScore),
      bestSeconds: readCount(fields.bestSeconds),
      hasWon: fields.hasWon === true,
      coins: readCount(fields.coins),
      unlocked: readUnlocked(fields.unlocked),
    };
  } catch {
    return emptyProfile();
  }
}

/** Profil du joueur, vide si rien n'est stocké ou si le stockage est interdit. */
export function loadProfile(store: KeyValueStore): Profile {
  try {
    return parseProfile(store.getItem(PROFILE_KEY));
  } catch {
    return emptyProfile();
  }
}

/** Écrit le profil. `false` si le stockage refuse (navigation privée, quota) : le jeu continue sans. */
export function saveProfile(store: KeyValueStore, profile: Profile): boolean {
  try {
    store.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Bilan de la partie, comparé au record du profil. */
export function summarizeRun(state: GameState, profile: Profile): RunSummary {
  const score = finalScore(state);
  return {
    score,
    seconds: survivedSeconds(state),
    hasWon: state.isBossDefeated,
    kills: state.kills,
    level: state.player.level,
    coins: coinsEarned(state),
    isNewRecord: score > profile.bestScore,
  };
}

/** Profil après une partie : pièces ajoutées, record et meilleur temps mis à jour. */
export function applyRun(profile: Profile, summary: RunSummary): Profile {
  return {
    bestScore: Math.max(profile.bestScore, summary.score),
    bestSeconds: Math.max(profile.bestSeconds, summary.seconds),
    hasWon: profile.hasWon || summary.hasWon,
    coins: profile.coins + summary.coins,
    unlocked: profile.unlocked,
  };
}

/** Prix d'un déblocage encore à acheter, ou `null` s'il est déjà acquis ou n'existe pas. */
export function unlockCost(profile: Profile, id: UpgradeId): number | null {
  const unlock = UNLOCKS.find((candidate) => candidate.id === id);
  return unlock === undefined || profile.unlocked.includes(id) ? null : unlock.cost;
}

/** Achète un déblocage. Renvoie le profil à jour, ou `null` s'il est déjà acquis ou trop cher. */
export function buyUnlock(profile: Profile, id: UpgradeId): Profile | null {
  const cost = unlockCost(profile, id);
  if (cost === null || cost > profile.coins) {
    return null;
  }
  return { ...profile, coins: profile.coins - cost, unlocked: [...profile.unlocked, id] };
}
