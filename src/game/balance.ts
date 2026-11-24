import type { EnemyKind, Gauge } from "./types.ts";

/**
 * Tous les chiffres d'équilibrage, en un seul endroit. Chaque valeur est décrite par une règle
 * « si… alors… » dans docs/product/SPECS.md : changer un chiffre ici = mettre à jour la spec.
 */
export const BALANCE = {
  startingLives: 20,
  /** Vies retirées par un ennemi ordinaire qui atteint la sortie. */
  leakLives: 1,
  /** Vies retirées par un boss qui atteint la sortie. */
  bossLeakLives: 5,
  startingMoney: 150,
  towerCost: 50,
  /** Part de l'argent dépensé (pose + améliorations) rendue à la revente. */
  sellRatio: 0.7,
  maxLevel: 5,
  /** Prix pour passer une jauge au niveau 2, 3, 4 puis 5. */
  upgradeCosts: [25, 50, 90, 150],
  intermissionSeconds: 10,
  /** Bonus du clic « Vague suivante » : par seconde entière restante sur le compte à rebours. */
  earlyCallBonusPerSecond: 2,
  /** Vitesse des projectiles, en cases par seconde. */
  projectileSpeed: 8,
  /** Les points de vie des ennemis sont multipliés par ce facteur à chaque vague. */
  hpGrowthPerWave: 1.15,
  bossEvery: 10,
} as const;

/** Valeur de chaque jauge aux niveaux 1 à 5 (index 0 = niveau 1). */
export const GAUGE_VALUES: Record<Gauge, readonly number[]> = {
  /** Dégâts par tir. */
  damage: [10, 16, 25, 38, 56],
  /** Portée en cases, mesurée depuis le centre de la tourelle. */
  range: [2, 2.5, 3, 3.5, 4],
  /** Tirs par seconde. */
  rate: [1, 1.35, 1.8, 2.4, 3.2],
};

export interface EnemyProfile {
  /** Points de vie à la vague 1. */
  readonly baseHp: number;
  /** Cases par seconde. */
  readonly speed: number;
  readonly reward: number;
}

export const ENEMY_PROFILES: Record<EnemyKind, EnemyProfile> = {
  normal: { baseHp: 20, speed: 1.4, reward: 5 },
  fast: { baseHp: 10, speed: 2.8, reward: 4 },
  tank: { baseHp: 80, speed: 0.7, reward: 12 },
  boss: { baseHp: 500, speed: 0.55, reward: 100 },
};
