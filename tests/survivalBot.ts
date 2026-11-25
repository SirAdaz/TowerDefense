import { ARENA_HEIGHT, ARENA_WIDTH, RUN_SECONDS, STEP_SECONDS } from "../src/survival/game/balance.ts";
import { coinsEarned, finalScore, step, survivedSeconds } from "../src/survival/game/engine.ts";
import { createGame } from "../src/survival/game/state.ts";
import type { Enemy, GameState, PlayerInput, UpgradeId } from "../src/survival/game/types.ts";
import { chooseUpgrade } from "../src/survival/game/upgrades.ts";

/** Façon de jouer du joueur automatique. */
export interface SurvivalBotProfile {
  /** `false` : reste planté au centre, comme un joueur qui a lâché la souris. */
  readonly isDodging: boolean;
  /** Carte préférée au passage de niveau ; à défaut, la première. */
  readonly prefers: "weapon" | "passive" | "first";
}

export interface SurvivalBotResult {
  readonly hasWon: boolean;
  readonly seconds: number;
  readonly level: number;
  readonly score: number;
  readonly kills: number;
  readonly coins: number;
  readonly peakEnemies: number;
  readonly hpLeft: number;
}

const DANGER_RADIUS = 300;
const GEM_RADIUS = 420;
/** Temps laissé pour battre le boss avant de compter la partie comme perdue. */
const BOSS_FIGHT_SECONDS = 180;
/** Le joueur automatique réévalue sa route 15 fois par seconde, comme une main sur la souris. */
const DECISION_STEPS = 4;
const DIRECTION_COUNT = 16;
const LOOKAHEAD = 70;
const WALL_MARGIN = 90;

/** Ennemis assez proches pour compter dans la décision en cours (liste réutilisée). */
const threats: Enemy[] = [];

function collectThreats(state: GameState): void {
  const { player } = state;
  threats.length = 0;
  for (const enemy of state.enemies) {
    const gap = Math.hypot(enemy.x - player.x, enemy.y - player.y) - enemy.radius;
    if (enemy.isActive && gap < DANGER_RADIUS + LOOKAHEAD) {
      threats.push(enemy);
    }
  }
}

/** Danger d'un point : chaque ennemi proche pèse d'autant plus qu'il en est près. */
function dangerAt(x: number, y: number): number {
  let danger = 0;
  for (const enemy of threats) {
    const gap = Math.hypot(enemy.x - x, enemy.y - y) - enemy.radius;
    if (gap < DANGER_RADIUS) {
      danger += 1 / Math.max(gap, 6) ** 2;
    }
  }
  const wallGap = Math.min(x, y, ARENA_WIDTH - x, ARENA_HEIGHT - y);
  return danger + (wallGap < WALL_MARGIN ? (WALL_MARGIN - wallGap) * 0.00002 : 0);
}

function nearestGemDistance(state: GameState, x: number, y: number): number {
  let nearest = GEM_RADIUS;
  for (const gem of state.gems) {
    if (gem.isActive) {
      nearest = Math.min(nearest, Math.hypot(gem.x - x, gem.y - y));
    }
  }
  return nearest;
}

/** Essaie 16 directions (et rester sur place) : garde la moins dangereuse, à danger égal la plus proche d'un éclat. */
function steer(state: GameState, input: PlayerInput): void {
  const { player } = state;
  let bestScore = Infinity;
  collectThreats(state);
  for (let direction = -1; direction < DIRECTION_COUNT; direction++) {
    const angle = (direction / DIRECTION_COUNT) * Math.PI * 2;
    const reach = direction < 0 ? 0 : LOOKAHEAD;
    const x = Math.min(Math.max(player.x + Math.cos(angle) * reach, 0), ARENA_WIDTH);
    const y = Math.min(Math.max(player.y + Math.sin(angle) * reach, 0), ARENA_HEIGHT);
    const score = dangerAt(x, y) + nearestGemDistance(state, x, y) * 0.000002;
    if (score < bestScore) {
      bestScore = score;
      input.targetX = x;
      input.targetY = y;
    }
  }
}

function pickChoice(state: GameState, profile: SurvivalBotProfile): number {
  const preferred = state.choices.findIndex((choice) => choice.kind === profile.prefers);
  return Math.max(preferred, 0);
}

/** Joue une nuit entière avec la graine donnée. Même graine + même profil = même résultat. */
export function playSurvivalBot(
  seed: number,
  profile: SurvivalBotProfile,
  unlocked: readonly UpgradeId[] = [],
): SurvivalBotResult {
  const state = createGame(seed, unlocked);
  const input: PlayerInput = { targetX: ARENA_WIDTH / 2, targetY: ARENA_HEIGHT / 2 };
  const maxSteps = (RUN_SECONDS + BOSS_FIGHT_SECONDS) / STEP_SECONDS;
  let peakEnemies = 0;
  for (let stepIndex = 0; stepIndex < maxSteps && state.phase !== "won" && state.phase !== "lost"; stepIndex++) {
    if (state.phase === "levelUp") {
      chooseUpgrade(state, pickChoice(state, profile));
      continue;
    }
    if (profile.isDodging && stepIndex % DECISION_STEPS === 0) {
      steer(state, input);
    }
    step(state, input);
    peakEnemies = Math.max(peakEnemies, state.enemyCount);
  }
  return {
    hasWon: state.phase === "won",
    seconds: survivedSeconds(state),
    level: state.player.level,
    score: finalScore(state),
    kills: state.kills,
    coins: coinsEarned(state),
    peakEnemies,
    hpLeft: Math.round(state.player.hp),
  };
}
