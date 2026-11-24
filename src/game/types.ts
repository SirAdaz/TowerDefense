/** Les trois jauges d'amélioration de l'unique tourelle. */
export type Gauge = "damage" | "range" | "rate";

export const GAUGES: readonly Gauge[] = ["damage", "range", "rate"];

export type EnemyKind = "normal" | "fast" | "tank" | "boss";

/** intermission : entre deux vagues (ou avant la première) ; wave : ennemis en route ; gameOver : plus de vies. */
export type Phase = "intermission" | "wave" | "gameOver";

export type GaugeLevels = Record<Gauge, number>;

export interface Tower {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  levels: GaugeLevels;
  /** Total payé (pose + améliorations) : base du prix de revente. */
  spent: number;
  /** Secondes avant le prochain tir. */
  cooldown: number;
  kills: number;
}

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
  hp: number;
  readonly maxHp: number;
  /** Vitesse en cases par seconde. */
  readonly speed: number;
  readonly reward: number;
  /** Distance parcourue sur le chemin, en cases. */
  distance: number;
}

export interface Projectile {
  readonly id: number;
  readonly towerId: number;
  readonly targetId: number;
  readonly damage: number;
  x: number;
  y: number;
}

export interface GameState {
  phase: Phase;
  /** Numéro de la dernière vague lancée (0 avant la première). */
  wave: number;
  lives: number;
  money: number;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  /** Ennemis de la vague en cours qui ne sont pas encore entrés sur la carte. */
  spawnQueue: EnemyKind[];
  /** Secondes avant l'entrée du prochain ennemi de la file. */
  spawnTimer: number;
  /** Secondes avant le départ automatique de la vague suivante ; null = attend le clic (avant la vague 1). */
  intermissionLeft: number | null;
  nextId: number;
}
