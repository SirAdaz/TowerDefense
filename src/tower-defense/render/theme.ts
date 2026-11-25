import type { EnemyKind, Gauge } from "../game/balance.ts";

/**
 * Couleurs du canvas, style « plan technique » : fond bleu nuit, traits fins clairs, ambre pour
 * ce qui demande l'attention. Les mêmes teintes sont déclarées dans `style.css` pour l'interface.
 */
export const THEME = {
  background: "#0d2238",
  gridLine: "rgba(143, 196, 235, 0.09)",
  gridMark: "rgba(143, 196, 235, 0.4)",
  pathEdge: "#5fa8d8",
  pathFill: "#17344f",
  pathDash: "rgba(255, 193, 69, 0.6)",
  label: "#a9c1d8",
  ink: "#eaf3fb",
  outline: "#0a1a2b",
  towerFill: "#10283f",
  accent: "#ffc145",
  range: "#6fd3ff",
  rangeFill: "rgba(111, 211, 255, 0.1)",
  rangeBlocked: "#a9c1d8",
  danger: "#ff9a8c",
  hpBack: "#0a1a2b",
  hpFill: "#9be28a",
} as const;

/** Chaque ennemi a sa couleur ET sa forme : on les distingue sans dépendre de la couleur. */
export const ENEMY_COLORS: Readonly<Record<EnemyKind, string>> = {
  normal: "#ff9a8c",
  fast: "#ffd97a",
  tank: "#c9a8ff",
  boss: "#ffffff",
};

/** Rayon de chaque ennemi, en cases. */
export const ENEMY_RADIUS: Readonly<Record<EnemyKind, number>> = {
  normal: 0.2,
  fast: 0.19,
  tank: 0.27,
  boss: 0.42,
};

export const GAUGE_COLORS: Readonly<Record<Gauge, string>> = {
  damage: "#ff9f6b",
  range: "#6fd3ff",
  rate: "#9be28a",
};

export const FONT_FAMILY = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
