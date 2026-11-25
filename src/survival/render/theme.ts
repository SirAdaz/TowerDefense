import type { EnemyKind } from "../game/types.ts";

/**
 * Couleurs du canvas : une nuit violette, une lumière chaude pour le joueur, une teinte et une forme
 * par ennemi (on les distingue sans dépendre de la couleur). Les teintes d'interface sont dans `style.css`.
 */
export const THEME = {
  outside: "#07060c",
  arena: "#14111f",
  arenaDot: "#2b2540",
  arenaEdge: "#4a4168",
  arenaEdgeHurt: "#ff8fa6",
  player: "#ffe27a",
  playerCore: "#fffbe6",
  pickupRing: "rgba(255, 226, 122, 0.1)",
  hpBack: "#0d0a18",
  hpFill: "#ff8fa6",
  gem: "#7df0c0",
  spark: "#fff2b0",
  lance: "#e4f3ff",
  halo: "#fff6c9",
  pulse: "#fff6c9",
  bolt: "#ffffff",
  burst: "#f6f1e7",
  eliteRing: "#fff3c4",
  flash: "rgba(255, 255, 255, 0.8)",
  telegraph: "rgba(255, 255, 255, 0.55)",
  bossCore: "#05040a",
  bossCorona: "#ffd98a",
  bossBarBack: "#0d0a18",
  bossBarFill: "#ffd98a",
  label: "#f6f1e7",
} as const;

export const ENEMY_COLORS: Readonly<Record<EnemyKind, string>> = {
  drifter: "#f0708f",
  swarmer: "#ffa64d",
  brute: "#a583ff",
  charger: "#4fd6c9",
  boss: THEME.bossCore,
};

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
