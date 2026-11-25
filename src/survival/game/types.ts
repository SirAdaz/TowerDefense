export type EnemyKind = "drifter" | "swarmer" | "brute" | "charger" | "boss";
export type WeaponId = "spark" | "halo" | "pulse" | "storm" | "lance";
export type PassiveId = "vigor" | "swiftness" | "magnet" | "might" | "haste" | "regen" | "armor" | "wisdom";
export type UpgradeId = WeaponId | PassiveId;
export type Phase = "playing" | "levelUp" | "won" | "lost";
/** Étapes d'une charge : approche, arrêt qui annonce la charge, ruée en ligne droite. */
export type ChargeStage = "chase" | "windup" | "dash";
export type ProjectileKind = "spark" | "lance";

/**
 * Tous les objets ci-dessous vivent dans des réserves de taille fixe créées une fois par partie
 * (`isActive` dit si la place est occupée) : la simulation n'alloue rien pendant qu'elle tourne.
 */
export interface Enemy {
  isActive: boolean;
  kind: EnemyKind;
  isElite: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  /** Temps restant du flash blanc après un coup (rendu seulement). */
  flashTimer: number;
  stage: ChargeStage;
  stageTimer: number;
  dashX: number;
  dashY: number;
  /** Recul reçu (onde de choc), en unités par seconde ; s'amortit tout seul. */
  pushX: number;
  pushY: number;
  /** Boss : temps avant le prochain renfort. */
  summonTimer: number;
}

export interface Projectile {
  isActive: boolean;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  /** Ennemis qu'il peut encore traverser après le prochain touché. */
  pierce: number;
  secondsLeft: number;
  /** Indices des derniers ennemis touchés : un projectile perçant ne frappe pas deux fois le même. */
  recentHits: Int16Array;
  hitCursor: number;
}

export interface Gem {
  isActive: boolean;
  x: number;
  y: number;
  value: number;
  /** Une fois attiré, un éclat suit le joueur jusqu'au ramassage. */
  isAttracted: boolean;
}

/** Effet visuel bref (anneau d'un ennemi détruit, impact de foudre). Sans effet sur les règles. */
export interface Effect {
  isActive: boolean;
  kind: "burst" | "bolt";
  x: number;
  y: number;
  radius: number;
  age: number;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  /** Invulnérabilité restante après un coup. */
  hurtTimer: number;
  level: number;
  xp: number;
  xpToNext: number;
}

/** Valeurs dérivées des passifs, recalculées à chaque amélioration choisie. */
export interface Stats {
  maxHp: number;
  moveSpeed: number;
  pickupRadius: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  regenPerSecond: number;
  damageTakenMultiplier: number;
  xpMultiplier: number;
}

export interface WeaponState {
  /** 0 : arme non possédée. */
  level: number;
  cooldown: number;
  /** Halo : angle courant des orbes. */
  angle: number;
  /** Onde : temps depuis la dernière détonation (rendu de l'anneau). */
  effectAge: number;
}

/** Une carte d'amélioration proposée. `level` : niveau obtenu si ce choix est pris. */
export type UpgradeChoice =
  | { readonly kind: "weapon"; readonly id: WeaponId; readonly level: number }
  | { readonly kind: "passive"; readonly id: PassiveId; readonly level: number }
  | { readonly kind: "heal"; readonly id: "heal"; readonly level: 0 };

/** Grille de recherche des voisins : une liste chaînée d'ennemis par case, dans des tableaux fixes. */
export interface SpatialGrid {
  readonly heads: Int16Array;
  readonly next: Int16Array;
  /** Résultat de la dernière recherche : indices d'ennemis. */
  readonly nearby: Int16Array;
}

/** Ce que le joueur commande : le point que son personnage cherche à rejoindre. */
export interface PlayerInput {
  targetX: number;
  targetY: number;
}

export interface GameState {
  phase: Phase;
  /** Temps de jeu écoulé, en secondes. */
  time: number;
  /** État du générateur pseudo-aléatoire : même graine + mêmes entrées = même partie. */
  rngState: number;
  player: Player;
  stats: Stats;
  weapons: Record<WeaponId, WeaponState>;
  passives: Record<PassiveId, number>;
  /** Armes et passifs débloqués entre les parties : ils entrent dans le tirage, rien de plus. */
  unlocked: readonly UpgradeId[];
  enemies: Enemy[];
  projectiles: Projectile[];
  gems: Gem[];
  effects: Effect[];
  grid: SpatialGrid;
  enemyCount: number;
  /** Ennemis « dus » par le rythme d'apparition, pas encore entrés. */
  spawnBudget: number;
  eliteTimer: number;
  isBossSpawned: boolean;
  isBossDefeated: boolean;
  pendingLevelUps: number;
  choices: UpgradeChoice[];
  kills: number;
  elitesKilled: number;
  /** Points des ennemis détruits (le score final y ajoute le temps tenu et le boss). */
  killPoints: number;
  /** Secousse d'écran restante après un coup reçu (rendu seulement). */
  shakeTimer: number;
}
