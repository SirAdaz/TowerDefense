import { BALANCE, GAUGE_VALUES } from "./balance.ts";
import { type Cell, isInsideGrid, isOnPath } from "./grid.ts";
import type { GameState, Gauge, GaugeLevels, Tower } from "./types.ts";

export interface TowerStats {
  readonly damage: number;
  readonly range: number;
  readonly fireRate: number;
}

function gaugeValue(gauge: Gauge, level: number): number {
  const values = GAUGE_VALUES[gauge];
  const index = Math.min(Math.max(level, 1), values.length) - 1;
  return values[index] ?? 0;
}

/** Caractéristiques d'une tourelle selon le niveau de ses trois jauges. */
export function towerStats(levels: GaugeLevels): TowerStats {
  return {
    damage: gaugeValue("damage", levels.damage),
    range: gaugeValue("range", levels.range),
    fireRate: gaugeValue("rate", levels.rate),
  };
}

/** Prix pour monter une jauge depuis `level` ; null si elle est déjà au maximum. */
export function upgradeCost(level: number): number | null {
  if (level >= BALANCE.maxLevel) return null;
  return BALANCE.upgradeCosts[level - 1] ?? null;
}

/** Argent rendu à la revente : 70 % de tout ce que la tourelle a coûté, arrondi à l'inférieur. */
export function sellValue(tower: Tower): number {
  return Math.floor(tower.spent * BALANCE.sellRatio);
}

export function towerAt(state: GameState, cell: Cell): Tower | undefined {
  return state.towers.find((tower) => tower.col === cell.col && tower.row === cell.row);
}

export function findTower(state: GameState, towerId: number): Tower | undefined {
  return state.towers.find((tower) => tower.id === towerId);
}

/** Vrai si la case accepte une tourelle : dans la carte, hors du chemin, libre. L'argent est vérifié à part. */
export function isBuildable(state: GameState, cell: Cell): boolean {
  return isInsideGrid(cell) && !isOnPath(cell) && !towerAt(state, cell);
}

/** Pose une tourelle (niveau 1 partout) si la case est libre et l'argent suffit. Renvoie la tourelle, sinon null. */
export function buildTower(state: GameState, cell: Cell): Tower | null {
  if (state.phase === "gameOver" || !isBuildable(state, cell) || state.money < BALANCE.towerCost) return null;
  const tower: Tower = {
    id: state.nextId++,
    col: cell.col,
    row: cell.row,
    levels: { damage: 1, range: 1, rate: 1 },
    spent: BALANCE.towerCost,
    cooldown: 0,
    kills: 0,
  };
  state.money -= BALANCE.towerCost;
  state.towers.push(tower);
  return tower;
}

/** Monte une jauge d'un niveau si l'argent suffit et qu'elle n'est pas au maximum. Vrai si c'est fait. */
export function upgradeTower(state: GameState, towerId: number, gauge: Gauge): boolean {
  const tower = findTower(state, towerId);
  if (!tower || state.phase === "gameOver") return false;
  const cost = upgradeCost(tower.levels[gauge]);
  if (cost === null || state.money < cost) return false;
  state.money -= cost;
  tower.spent += cost;
  tower.levels[gauge] += 1;
  return true;
}

/** Vend la tourelle : elle disparaît et rend sellValue. Ses projectiles déjà tirés continuent leur course. */
export function sellTower(state: GameState, towerId: number): boolean {
  const tower = findTower(state, towerId);
  if (!tower || state.phase === "gameOver") return false;
  state.money += sellValue(tower);
  state.towers = state.towers.filter((candidate) => candidate.id !== towerId);
  return true;
}
