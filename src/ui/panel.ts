import { BALANCE } from "../game/balance.ts";
import { sellValue, upgradeCost } from "../game/towers.ts";
import { GAUGES, type Gauge, type Tower } from "../game/types.ts";
import { byId, query, setAttr, setDisabled, setHidden, setText } from "./dom.ts";

const GAUGE_NAMES: Record<Gauge, string> = { damage: "Dégâts", range: "Portée", rate: "Cadence" };

interface GaugeRow {
  readonly gauge: Gauge;
  readonly pips: HTMLElement;
  readonly pipCells: readonly HTMLElement[];
  readonly button: HTMLButtonElement;
}

export interface PanelElements {
  readonly empty: HTMLElement;
  readonly towerBox: HTMLElement;
  readonly kills: HTMLElement;
  readonly rows: readonly GaugeRow[];
  readonly sell: HTMLButtonElement;
}

export interface PanelInfo {
  readonly tower: Tower | undefined;
  readonly money: number;
  /** Vrai en pause ou après la défaite : on regarde, on n'achète pas. */
  readonly isLocked: boolean;
}

function createRow(gauge: Gauge): GaugeRow {
  const row = query<HTMLElement>(document, `.gauge[data-gauge="${gauge}"]`);
  const pips = query<HTMLElement>(row, ".pips");
  const pipCells = Array.from({ length: BALANCE.maxLevel }, () => {
    const pip = document.createElement("span");
    pip.className = "pip";
    pips.append(pip);
    return pip;
  });
  return { gauge, pips, pipCells, button: query<HTMLButtonElement>(row, ".upgrade") };
}

/** Récupère le panneau et crée les 5 cases de chaque jauge (une seule fois). */
export function getPanel(): PanelElements {
  return {
    empty: byId("panel-empty"),
    towerBox: byId("panel-tower"),
    kills: byId("tower-kills"),
    rows: GAUGES.map(createRow),
    sell: byId("sell"),
  };
}

function renderRow(row: GaugeRow, tower: Tower, info: PanelInfo): void {
  const level = tower.levels[row.gauge];
  const name = GAUGE_NAMES[row.gauge];
  row.pipCells.forEach((pip, index) => pip.classList.toggle("is-on", index < level));
  setAttr(row.pips, "aria-label", `${name} : niveau ${level} sur ${BALANCE.maxLevel}`);
  const cost = upgradeCost(level);
  setText(row.button, cost === null ? "MAX" : `+ ${cost} $`);
  setAttr(row.button, "aria-label", cost === null ? `${name} au maximum` : `Améliorer ${name.toLowerCase()} pour ${cost} $`);
  setDisabled(row.button, cost === null || info.money < cost || info.isLocked);
}

/** Met à jour le panneau de droite : aide quand rien n'est sélectionné, sinon les 3 jauges et la revente. */
export function renderPanel(panel: PanelElements, info: PanelInfo): void {
  const { tower } = info;
  setHidden(panel.empty, Boolean(tower));
  setHidden(panel.towerBox, !tower);
  if (!tower) return;
  setText(panel.kills, `${tower.kills} abattu${tower.kills > 1 ? "s" : ""}`);
  for (const row of panel.rows) renderRow(row, tower, info);
  const refund = sellValue(tower);
  setText(panel.sell, `Vendre +${refund} $`);
  setAttr(panel.sell, "aria-label", `Vendre la tourelle pour ${refund} $`);
  setDisabled(panel.sell, info.isLocked);
}
