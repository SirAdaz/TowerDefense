/**
 * Tous les chiffres d'équilibrage du jeu. Source de vérité : `docs/product/SPECS.md` reprend ces valeurs,
 * et `tests/balance.test.ts` vérifie la courbe de difficulté qu'elles produisent.
 */

/** Durée d'un pas de simulation : 60 pas par seconde de jeu. */
export const STEP_SECONDS = 1 / 60;

export const START_LIVES = 20;
export const START_MONEY = 150;

export const TOWER_COST = 50;
export const MAX_LEVEL = 5;
/** Part du coût total (pose + améliorations) rendue à la vente. */
export const SELL_RATIO = 0.75;

export const GAUGES = ["damage", "range", "rate"] as const;
export type Gauge = (typeof GAUGES)[number];

/** Valeur de chaque jauge par niveau (indice 0 = niveau 1). Portée en cases, cadence en tirs par seconde. */
export const GAUGE_VALUES: Readonly<Record<Gauge, readonly number[]>> = {
  damage: [10, 16, 24, 34, 46],
  range: [2, 2.4, 2.8, 3.2, 3.6],
  rate: [1, 1.3, 1.7, 2.2, 2.8],
};

/** Prix pour passer au niveau 2, 3, 4 puis 5 : le même pour les trois jauges. */
export const UPGRADE_COSTS: readonly number[] = [30, 60, 110, 180];

export const ENEMY_KINDS = ["normal", "fast", "tank", "boss"] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

export interface EnemyStats {
  /** Vie à la vague 1, avant la croissance par vague. */
  readonly baseHp: number;
  /** Vitesse en cases par seconde. */
  readonly speed: number;
  /** Argent gagné quand l'ennemi est tué. */
  readonly bounty: number;
  /** Vies retirées quand l'ennemi atteint la sortie. */
  readonly livesLost: number;
}

export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = {
  normal: { baseHp: 24, speed: 1.2, bounty: 5, livesLost: 1 },
  fast: { baseHp: 12, speed: 2.4, bounty: 4, livesLost: 1 },
  tank: { baseHp: 96, speed: 0.7, bounty: 12, livesLost: 1 },
  boss: { baseHp: 480, speed: 0.6, bounty: 100, livesLost: 5 },
};

/** La vie des ennemis est multipliée par ce facteur à chaque vague. */
export const HP_GROWTH = 1.12;

export const BOSS_EVERY = 10;
export const FAST_FROM_WAVE = 3;
export const TANK_FROM_WAVE = 4;
/** À partir de TANK_FROM_WAVE, un ennemi sur TANK_EVERY est un costaud. */
export const TANK_EVERY = 4;

export const BASE_ENEMY_COUNT = 6;
export const ENEMY_COUNT_PER_WAVE = 2;
export const MAX_ENEMY_COUNT = 50;

export const SPAWN_INTERVAL_START = 0.9;
export const SPAWN_INTERVAL_DROP_PER_WAVE = 0.02;
export const SPAWN_INTERVAL_MIN = 0.4;

/** Délai entre la fin d'une vague et le départ automatique de la suivante. */
export const COUNTDOWN_SECONDS = 10;
/** Bonus par seconde entière restante quand on lance la vague avant la fin du délai. */
export const EARLY_BONUS_PER_SECOND = 2;
