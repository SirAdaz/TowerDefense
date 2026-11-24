import { BALANCE } from "../src/game/balance.ts";
import { STEP_SECONDS, createGame, step } from "../src/game/game.ts";
import { COLS, PATH, ROWS, type Cell, isOnPath } from "../src/game/grid.ts";
import { buildTower, isBuildable, upgradeCost, upgradeTower } from "../src/game/towers.ts";
import type { GameState, Gauge } from "../src/game/types.ts";

/** Joueur automatique pour mesurer l'équilibrage (tests et scripts/simulate.ts), jamais chargé par le jeu. */
export interface BotOptions {
  /** Nombre maximum de tourelles posées. */
  readonly maxTowers: number;
  /** Vrai : améliore les jauges ; faux : ne fait que poser. */
  readonly canUpgrade: boolean;
  /** Arrêt de la simulation, pour ne pas tourner sans fin. */
  readonly maxWave: number;
}

export interface BotResult {
  /** Vague pendant laquelle la partie est perdue (ou maxWave si elle tient jusque-là). */
  readonly waveReached: number;
  readonly livesLostByWave: readonly number[];
}

function pathCellsNear(cell: Cell, radius: number): number {
  return PATH.filter((pathCell) => Math.hypot(pathCell.col - cell.col, pathCell.row - cell.row) <= radius).length;
}

/** Cases libres triées de la plus utile (le plus de chemin à portée) à la moins utile. */
function rankedCells(): Cell[] {
  const cells: Cell[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) if (!isOnPath({ col, row })) cells.push({ col, row });
  }
  return cells.sort((a, b) => pathCellsNear(b, 2) - pathCellsNear(a, 2));
}

const RANKED_CELLS = rankedCells();
const UPGRADE_ORDER: readonly Gauge[] = ["damage", "rate", "range"];

function cheapestUpgrade(state: GameState): { towerId: number; gauge: Gauge; cost: number } | null {
  let best: { towerId: number; gauge: Gauge; cost: number } | null = null;
  for (const gauge of UPGRADE_ORDER) {
    for (const tower of state.towers) {
      const cost = upgradeCost(tower.levels[gauge]);
      if (cost !== null && (!best || cost < best.cost)) best = { towerId: tower.id, gauge, cost };
    }
  }
  return best;
}

function tryBuild(state: GameState, options: BotOptions): boolean {
  if (state.towers.length >= options.maxTowers) return false;
  const cell = RANKED_CELLS.find((candidate) => isBuildable(state, candidate));
  return cell ? buildTower(state, cell) !== null : false;
}

/**
 * Dépense l'argent comme un joueur moyen : garde au moins « 3 + vague / 2 » tourelles (dans la limite
 * de maxTowers), puis améliore la jauge la moins chère.
 */
function spend(state: GameState, options: BotOptions): void {
  for (let guard = 0; guard < 50; guard++) {
    if (!spendOnce(state, options)) return;
  }
}

/** Une dépense ; faux quand il n'y a plus rien d'utile à acheter maintenant (on attend d'avoir plus d'argent). */
function needsMoreTowers(state: GameState, options: BotOptions): boolean {
  return state.towers.length < options.maxTowers && state.towers.length < 3 + state.wave / 2;
}

function spendOnce(state: GameState, options: BotOptions): boolean {
  const upgrade = options.canUpgrade ? cheapestUpgrade(state) : null;
  const needsTower = needsMoreTowers(state, options);
  const shouldBuild = !upgrade || needsTower || BALANCE.towerCost <= upgrade.cost;
  if (shouldBuild && state.money >= BALANCE.towerCost && tryBuild(state, options)) return true;
  if (needsTower || !upgrade || state.money < upgrade.cost) return false;
  return upgradeTower(state, upgrade.towerId, upgrade.gauge);
}

/** Joue une partie complète : dépense à chaque seconde, laisse partir chaque vague au bout des 10 s. */
export function playGame(options: BotOptions): BotResult {
  const state = createGame();
  const livesLostByWave: number[] = [];
  spend(state, options);
  state.intermissionLeft = 0;
  let livesAtWaveStart = state.lives;
  let elapsedSteps = 0;
  while (state.phase !== "gameOver" && state.wave <= options.maxWave) {
    const waveBefore = state.wave;
    step(state, STEP_SECONDS);
    elapsedSteps += 1;
    if (state.wave !== waveBefore) livesAtWaveStart = state.lives;
    if (state.phase === "intermission" && state.intermissionLeft === BALANCE.intermissionSeconds) {
      livesLostByWave[state.wave] = livesAtWaveStart - state.lives;
    }
    if (elapsedSteps % 60 === 0) spend(state, options);
  }
  return { waveReached: Math.min(state.wave, options.maxWave), livesLostByWave };
}

