import { GAUGES, type Gauge } from "../game/balance.ts";
import { gaugeValue, sellValue, upgradeCost } from "../game/towers.ts";
import type { Tower } from "../game/types.ts";
import { formatMoney, requireElement, setAttribute, setText, setUnavailable } from "./dom.ts";

export interface TowerPanel {
  readonly sellButton: HTMLButtonElement;
  readonly upgradeButtons: Readonly<Record<Gauge, HTMLButtonElement>>;
  /** Affiche la tourelle sélectionnée, ou l'aide si `tower` est `undefined`. */
  refresh(tower: Tower | undefined, money: number): void;
}

interface GaugeRow {
  readonly value: HTMLElement;
  readonly pips: readonly Element[];
  readonly button: HTMLButtonElement;
}

const GAUGE_NAMES: Readonly<Record<Gauge, string>> = { damage: "dégâts", range: "portée", rate: "cadence" };
const GAUGE_UNITS: Readonly<Record<Gauge, string>> = { damage: "par tir", range: "cases", rate: "tirs/s" };

function formatValue(gauge: Gauge, level: number): string {
  return String(gaugeValue(gauge, level)).replace(".", ",");
}

function gaugeRow(gauge: Gauge): GaugeRow {
  return {
    value: requireElement(`gauge-${gauge}-value`, HTMLElement),
    pips: [...requireElement(`gauge-${gauge}-pips`, HTMLElement).children],
    button: requireElement(`upgrade-${gauge}`, HTMLButtonElement),
  };
}

function refreshGauge(row: GaugeRow, gauge: Gauge, tower: Tower, money: number): void {
  const level = tower.levels[gauge];
  const cost = upgradeCost(level);
  row.pips.forEach((pip, index) => pip.classList.toggle("is-on", index < level));
  if (cost === null) {
    setText(row.value, `${formatValue(gauge, level)} ${GAUGE_UNITS[gauge]}`);
    setText(row.button, "Niveau max");
    setAttribute(row.button, "aria-label", `Améliorer ${GAUGE_NAMES[gauge]} : niveau maximum atteint`);
    setUnavailable(row.button, true);
    return;
  }
  setText(row.value, `${formatValue(gauge, level)} → ${formatValue(gauge, level + 1)} ${GAUGE_UNITS[gauge]}`);
  setText(row.button, `Améliorer · ${formatMoney(cost)}`);
  const label = `Améliorer ${GAUGE_NAMES[gauge]} au niveau ${level + 1} pour ${formatMoney(cost)}`;
  setAttribute(row.button, "aria-label", label);
  setUnavailable(row.button, money < cost);
}

/** Relie la carte « Tourelle » (3 jauges, amélioration, vente) aux éléments du gabarit. */
export function createTowerPanel(): TowerPanel {
  const hint = requireElement("tower-hint", HTMLParagraphElement);
  const details = requireElement("tower-details", HTMLDivElement);
  const sellButton = requireElement("sell", HTMLButtonElement);
  const rows: Readonly<Record<Gauge, GaugeRow>> = {
    damage: gaugeRow("damage"),
    range: gaugeRow("range"),
    rate: gaugeRow("rate"),
  };

  return {
    sellButton,
    upgradeButtons: { damage: rows.damage.button, range: rows.range.button, rate: rows.rate.button },
    refresh(tower, money) {
      hint.hidden = tower !== undefined;
      details.hidden = tower === undefined;
      if (tower === undefined) {
        return;
      }
      for (const gauge of GAUGES) {
        refreshGauge(rows[gauge], gauge, tower, money);
      }
      setText(sellButton, `Vendre · +${formatMoney(sellValue(tower))}`);
    },
  };
}
