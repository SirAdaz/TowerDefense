import type { EnemyKind } from "../game/types.ts";

/** Taille d'une case dans le repère de dessin (unité fixe de dessin). */
export const CELL_PX = 56;

/** Couleurs de la direction visuelle « Pixel douillet ». */
export const COLORS = {
  grassA: "#5f9e4f",
  grassB: "#66a855",
  grassBlend: "#62a352",
  tuft: "#4f8a41",
  dirt: "#c9a26b",
  pebble: "#b48c57",
  stone: "#8d8d99",
  stoneLight: "#a9a9b5",
  stoneDark: "#6b6b78",
  wood: "#3b2f2a",
  highlight: "#fff0b4",
  rangeFill: "rgba(255, 240, 180, 0.18)",
  shot: "#ffe08a",
  invalid: "#d9534f",
  hpBack: "#1d1712",
  hpFill: "#7ee07a",
  eye: "#ffffff",
  crown: "#e9a23b",
} as const;

export interface EnemyLook {
  /** Côté du carré, en unités de dessin. */
  readonly size: number;
  readonly color: string;
}

export const ENEMY_LOOKS: Record<EnemyKind, EnemyLook> = {
  normal: { size: 22, color: "#d9534f" },
  fast: { size: 16, color: "#5bc0de" },
  tank: { size: 30, color: "#7d5ba6" },
  boss: { size: 42, color: "#2b2b36" },
};
