import { coinsEarned, finalScore, survivedSeconds } from "./engine.ts";
import type { Profile, RunSummary } from "./profile.ts";
import type { GameState } from "./types.ts";

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
