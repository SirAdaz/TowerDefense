import { GAUGES, GAUGE_VALUES, MAX_LEVEL, SELL_RATIO, TOWER_COST, UPGRADE_COSTS, type Gauge } from "./balance.ts";
import { isInsideGrid, isOnPath, type Cell } from "./grid.ts";
import type { GameState, Tower } from "./types.ts";

/** Valeur d'une jauge à un niveau donné (dégâts, portée en cases ou tirs par seconde). */
export function gaugeValue(gauge: Gauge, level: number): number {
  const boundedLevel = Math.min(Math.max(level, 1), MAX_LEVEL);
  return GAUGE_VALUES[gauge][boundedLevel - 1] ?? 0;
}

/** Valeur actuelle d'une jauge de la tourelle. */
export function towerStat(tower: Tower, gauge: Gauge): number {
  return gaugeValue(gauge, tower.levels[gauge]);
}

/** Prix pour passer du niveau donné au suivant, ou `null` au niveau maximum. */
export function upgradeCost(level: number): number | null {
  if (level >= MAX_LEVEL) {
    return null;
  }
  return UPGRADE_COSTS[level - 1] ?? null;
}

/** Tout ce que la tourelle a coûté. Calculé depuis ses niveaux : rien à stocker, rien à désynchroniser. */
export function towerSpent(tower: Tower): number {
  let spent = TOWER_COST;
  for (const gauge of GAUGES) {
    for (let level = 1; level < tower.levels[gauge]; level++) {
      spent += upgradeCost(level) ?? 0;
    }
  }
  return spent;
}

/** Argent rendu si on vend la tourelle. */
export function sellValue(tower: Tower): number {
  return Math.floor(towerSpent(tower) * SELL_RATIO);
}

/** Tourelle posée sur la case, s'il y en a une. */
export function towerAt(state: GameState, cell: Cell): Tower | undefined {
  return state.towers.find((tower) => tower.col === cell.col && tower.row === cell.row);
}

/** Tourelle par identifiant. */
export function towerById(state: GameState, towerId: number): Tower | undefined {
  return state.towers.find((tower) => tower.id === towerId);
}

/** Vrai si la case accepte une tourelle (dans la carte, hors chemin, libre), sans regarder l'argent. */
export function isBuildable(state: GameState, cell: Cell): boolean {
  return isInsideGrid(cell) && !isOnPath(cell) && towerAt(state, cell) === undefined;
}

/** Pose une tourelle si la case est libre et l'argent suffisant. Renvoie la tourelle, ou `null` si refusé. */
export function buildTower(state: GameState, cell: Cell): Tower | null {
  if (state.phase === "over" || !isBuildable(state, cell) || state.money < TOWER_COST) {
    return null;
  }
  const tower: Tower = {
    id: state.nextId,
    col: cell.col,
    row: cell.row,
    levels: { damage: 1, range: 1, rate: 1 },
    cooldown: 0,
  };
  state.nextId += 1;
  state.money -= TOWER_COST;
  state.towers.push(tower);
  return tower;
}

/** Monte une jauge d'un niveau si possible. Renvoie vrai si l'amélioration a eu lieu. */
export function upgradeTower(state: GameState, towerId: number, gauge: Gauge): boolean {
  const tower = towerById(state, towerId);
  if (state.phase === "over" || tower === undefined) {
    return false;
  }
  const cost = upgradeCost(tower.levels[gauge]);
  if (cost === null || state.money < cost) {
    return false;
  }
  state.money -= cost;
  tower.levels[gauge] += 1;
  return true;
}

/** Vend la tourelle. Renvoie l'argent rendu, ou `null` si la vente est refusée. */
export function sellTower(state: GameState, towerId: number): number | null {
  const tower = towerById(state, towerId);
  if (state.phase === "over" || tower === undefined) {
    return null;
  }
  const refund = sellValue(tower);
  state.money += refund;
  state.towers = state.towers.filter((candidate) => candidate.id !== towerId);
  return refund;
}
