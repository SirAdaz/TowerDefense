import { GAUGES, GAUGE_VALUES, TOWER_COST, type Gauge } from "../src/game/balance.ts";
import { createGame, startNextWave, step } from "../src/game/engine.ts";
import { COLS, PATH, ROWS, cellCenter, isOnPath, type Cell } from "../src/game/grid.ts";
import { buildTower, isBuildable, upgradeCost, upgradeTower } from "../src/game/towers.ts";
import type { GameState, Tower } from "../src/game/types.ts";

/** Profil de joueur automatique : combien de tourelles il pose, et s'il les améliore. */
export interface BotProfile {
  readonly maxTowers: number;
  readonly shouldUpgrade: boolean;
  /** Vrai : lance chaque vague dès que possible (bonus). Faux : laisse le compte à rebours finir. */
  readonly shouldRush: boolean;
}

export interface BotResult {
  /** Vague atteinte à la défaite (ou à l'arrêt de la simulation). */
  readonly waveReached: number;
  /** Première vague où une vie a été perdue, ou `null` si aucune. */
  readonly firstLossWave: number | null;
  readonly isDefeated: boolean;
}

/** Le bot joue deux fois par seconde de jeu : assez pour dépenser, sans ralentir les tests. */
const STEPS_BETWEEN_DECISIONS = 30;

function pathCoverage(cell: Cell): number {
  const center = cellCenter(cell);
  const baseRange = GAUGE_VALUES.range[0] ?? 0;
  return PATH.filter((pathCell) => {
    const target = cellCenter(pathCell);
    return Math.hypot(target.x - center.x, target.y - center.y) <= baseRange;
  }).length;
}

/** Cases libres, de celle qui couvre le plus de chemin à celle qui en couvre le moins. */
function rankedCells(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isOnPath({ col, row })) {
        cells.push({ col, row });
      }
    }
  }
  return cells.sort((a, b) => pathCoverage(b) - pathCoverage(a));
}

const RANKED_CELLS = rankedCells();

function cheapestUpgrade(state: GameState): { tower: Tower; gauge: Gauge; cost: number } | null {
  let best: { tower: Tower; gauge: Gauge; cost: number } | null = null;
  for (const tower of state.towers) {
    for (const gauge of GAUGES) {
      const cost = upgradeCost(tower.levels[gauge]);
      if (cost !== null && (best === null || cost < best.cost)) {
        best = { tower, gauge, cost };
      }
    }
  }
  return best;
}

function spendOnce(state: GameState, profile: BotProfile): boolean {
  if (state.towers.length < profile.maxTowers && state.money >= TOWER_COST) {
    const cell = RANKED_CELLS.find((candidate) => isBuildable(state, candidate));
    return cell !== undefined && buildTower(state, cell) !== null;
  }
  if (!profile.shouldUpgrade || state.towers.length < profile.maxTowers) {
    return false;
  }
  const upgrade = cheapestUpgrade(state);
  return upgrade !== null && upgradeTower(state, upgrade.tower.id, upgrade.gauge);
}

function decide(state: GameState, profile: BotProfile): void {
  let hasSpent = true;
  while (hasSpent) {
    hasSpent = spendOnce(state, profile);
  }
  if (state.phase === "ready" || (profile.shouldRush && state.phase === "countdown")) {
    startNextWave(state);
  }
}

/** Joue une partie entière avec le profil donné, jusqu'à la défaite ou `maxWave`. */
export function playBot(profile: BotProfile, maxWave = 60): BotResult {
  const state = createGame();
  let firstLossWave: number | null = null;
  let stepCount = 0;
  while (state.phase !== "over" && state.wave <= maxWave) {
    if (stepCount % STEPS_BETWEEN_DECISIONS === 0) {
      decide(state, profile);
    }
    const livesBefore = state.lives;
    step(state);
    if (firstLossWave === null && state.lives < livesBefore) {
      firstLossWave = state.wave;
    }
    stepCount += 1;
  }
  return { waveReached: state.wave, firstLossWave, isDefeated: state.phase === "over" };
}
