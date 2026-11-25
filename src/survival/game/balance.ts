import type { EnemyKind, PassiveId, UpgradeId, WeaponId } from "./types.ts";

/** Tous les chiffres du jeu. Source de vérité de `docs/product/SPECS-NUIT-BLANCHE.md`. */

export const STEP_SECONDS = 1 / 60;
/** L'arène est fixe et tient à l'écran : le joueur voit toujours tout ce qui le menace. */
export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;
/** Durée d'une nuit : à cet instant le boss entre, et le battre fait gagner. */
export const RUN_SECONDS = 600;

export const MAX_ENEMIES = 360;
export const MAX_PROJECTILES = 200;
export const MAX_GEMS = 300;
export const MAX_EFFECTS = 64;

export const PLAYER = {
  radius: 12,
  speed: 330,
  maxHp: 100,
  pickupRadius: 130,
  /** Invulnérabilité après un coup : un essaim ne vide pas la vie en une image. */
  hurtCooldown: 0.5,
  gemSpeed: 640,
} as const;

/** Expérience demandée pour quitter un niveau : `XP_BASE + XP_PER_LEVEL × n + XP_CURVE × n²` (n = niveaux déjà passés). */
export const XP_BASE = 2;
export const XP_PER_LEVEL = 5;
export const XP_CURVE = 0.5;

export interface EnemyStats {
  readonly hp: number;
  readonly speed: number;
  readonly radius: number;
  readonly damage: number;
  readonly xp: number;
  readonly points: number;
  /** 0 : ne charge jamais. */
  readonly dashSpeed: number;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  drifter: { hp: 10, speed: 82, radius: 13, damage: 8, xp: 1, points: 10, dashSpeed: 0 },
  swarmer: { hp: 6, speed: 150, radius: 8, damage: 5, xp: 1, points: 8, dashSpeed: 0 },
  brute: { hp: 80, speed: 52, radius: 24, damage: 16, xp: 5, points: 40, dashSpeed: 0 },
  charger: { hp: 30, speed: 95, radius: 14, damage: 12, xp: 3, points: 30, dashSpeed: 420 },
  boss: { hp: 7200, speed: 72, radius: 56, damage: 28, xp: 0, points: 0, dashSpeed: 540 },
};

export const CHARGE = {
  /** Distance au joueur à partir de laquelle une charge se prépare. */
  range: 380,
  windupSeconds: 0.8,
  dashSeconds: 0.55,
  restSeconds: 2.6,
} as const;

export const ELITE = { hpFactor: 8, radiusFactor: 1.5, xp: 15, pointsFactor: 5, firstAt: 90, everySeconds: 45 } as const;

export const BOSS = { summonEverySeconds: 6, summonCount: 6, spawnRateFactor: 0.35, points: 5000 } as const;

/** Rythme d'apparition (ennemis par seconde) et vie des ennemis : tous deux montent avec les minutes. */
export const SPAWN = {
  baseRate: 0.9,
  ratePerMinute: 0.8,
  hpPerMinute: 0.32,
  /** Minutes de montée douce en début de nuit (voir `rampMinutes`). */
  gentleMinutes: 2,
  /** Distance hors de l'arène où les ennemis apparaissent. */
  margin: 40,
  swarmSize: 3,
} as const;

/** Composition des arrivées : poids de chaque type à partir d'une minute donnée. */
export const SPAWN_MIX: ReadonlyArray<{ readonly fromMinute: number; readonly weights: Partial<Record<EnemyKind, number>> }> = [
  { fromMinute: 0, weights: { drifter: 10 } },
  { fromMinute: 1, weights: { drifter: 10, swarmer: 2 } },
  { fromMinute: 3.5, weights: { drifter: 10, swarmer: 2, brute: 2 } },
  { fromMinute: 4.5, weights: { drifter: 9, swarmer: 3, brute: 2, charger: 2 } },
  { fromMinute: 7, weights: { drifter: 7, swarmer: 3, brute: 3, charger: 4 } },
];

export const SCORE = { perSecond: 10 } as const;
export const COINS = { secondsPerCoin: 10, perElite: 3, forVictory: 30 } as const;

export const MAX_WEAPON_LEVEL = 5;
export const MAX_PASSIVE_LEVEL = 3;
export const HEAL_CHOICE_HP = 30;
export const CHOICE_COUNT = 3;
/** Vie rendue à chaque niveau franchi : la seule source de soin de base. */
export const LEVEL_UP_HEAL = 8;

/**
 * Un niveau d'arme. Les mêmes champs servent aux cinq armes : `count` = projectiles, orbes ou
 * éclairs ; `area` = rayon du projectile, de l'orbite, de l'onde ou de l'impact.
 */
export interface WeaponLevel {
  readonly damage: number;
  readonly cooldown: number;
  readonly count: number;
  readonly area: number;
  readonly pierce: number;
  /** Ce que le joueur lit sur la carte d'amélioration. */
  readonly text: string;
}

export interface WeaponDefinition {
  readonly name: string;
  readonly levels: readonly WeaponLevel[];
}

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  spark: {
    name: "Étincelle",
    levels: [
      { damage: 16, cooldown: 0.45, count: 1, area: 5, pierce: 0, text: "Un trait de lumière vers l'ennemi le plus proche." },
      { damage: 21, cooldown: 0.45, count: 1, area: 5, pierce: 0, text: "Dégâts +30 %." },
      { damage: 21, cooldown: 0.45, count: 2, area: 5, pierce: 0, text: "Deux traits à chaque tir." },
      { damage: 21, cooldown: 0.42, count: 2, area: 5, pierce: 1, text: "Tire plus vite, traverse un ennemi." },
      { damage: 26, cooldown: 0.42, count: 3, area: 6, pierce: 1, text: "Trois traits, dégâts +20 %." },
    ],
  },
  halo: {
    name: "Halo",
    levels: [
      { damage: 30, cooldown: 0, count: 2, area: 85, pierce: 0, text: "Deux orbes tournent autour de vous et brûlent ce qu'ils touchent." },
      { damage: 30, cooldown: 0, count: 3, area: 85, pierce: 0, text: "Un troisième orbe." },
      { damage: 46, cooldown: 0, count: 3, area: 95, pierce: 0, text: "Dégâts +50 %, orbite plus large." },
      { damage: 46, cooldown: 0, count: 4, area: 105, pierce: 0, text: "Un quatrième orbe, orbite plus large." },
      { damage: 70, cooldown: 0, count: 5, area: 110, pierce: 0, text: "Cinq orbes, dégâts +50 %." },
    ],
  },
  pulse: {
    name: "Onde",
    levels: [
      { damage: 18, cooldown: 3.6, count: 1, area: 150, pierce: 0, text: "Une onde part de vous, blesse et repousse les ennemis proches." },
      { damage: 28, cooldown: 3.6, count: 1, area: 150, pierce: 0, text: "Dégâts +55 %." },
      { damage: 28, cooldown: 3.6, count: 1, area: 195, pierce: 0, text: "Onde plus large." },
      { damage: 34, cooldown: 2.7, count: 1, area: 195, pierce: 0, text: "Se recharge plus vite." },
      { damage: 52, cooldown: 2.7, count: 1, area: 230, pierce: 0, text: "Onde encore plus large, dégâts +50 %." },
    ],
  },
  storm: {
    name: "Foudre",
    levels: [
      { damage: 26, cooldown: 2.2, count: 2, area: 46, pierce: 0, text: "La foudre frappe deux ennemis au hasard, où qu'ils soient." },
      { damage: 26, cooldown: 2.2, count: 3, area: 46, pierce: 0, text: "Trois éclairs." },
      { damage: 40, cooldown: 2.2, count: 3, area: 56, pierce: 0, text: "Dégâts +50 %, impact plus large." },
      { damage: 40, cooldown: 1.6, count: 4, area: 56, pierce: 0, text: "Quatre éclairs, plus souvent." },
      { damage: 58, cooldown: 1.6, count: 6, area: 64, pierce: 0, text: "Six éclairs, dégâts +45 %." },
    ],
  },
  lance: {
    name: "Comète",
    levels: [
      { damage: 22, cooldown: 1.8, count: 1, area: 11, pierce: 999, text: "Une comète lente qui traverse tous les ennemis sur sa route." },
      { damage: 32, cooldown: 1.8, count: 1, area: 11, pierce: 999, text: "Dégâts +45 %." },
      { damage: 32, cooldown: 1.8, count: 2, area: 12, pierce: 999, text: "Une seconde comète part à l'opposé." },
      { damage: 38, cooldown: 1.3, count: 2, area: 12, pierce: 999, text: "Se recharge plus vite." },
      { damage: 56, cooldown: 1.3, count: 2, area: 16, pierce: 999, text: "Comètes plus grosses, dégâts +45 %." },
    ],
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const SPARK_SPEED = 640;
/** Durée de vol de l'étincelle : sa portée (environ 580 unités) fait tomber les éclats près du joueur. */
export const SPARK_SECONDS = 0.9;
export const LANCE_SECONDS = 4.5;
export const LANCE_SPEED = 430;
export const HALO_TURNS_PER_SECOND = 0.55;
export const HALO_ORB_RADIUS = 13;
export const PULSE_PUSH = 420;

export interface PassiveDefinition {
  readonly name: string;
  readonly text: string;
}

/** Chaque niveau d'un passif ajoute le même bonus (voir `recomputeStats`). */
export const PASSIVES: Record<PassiveId, PassiveDefinition> = {
  vigor: { name: "Vigueur", text: "Vie maximale +20, et autant de vie rendue." },
  swiftness: { name: "Élan", text: "Vitesse de déplacement +8 %." },
  magnet: { name: "Aimant", text: "Ramasse les éclats de 35 % plus loin." },
  might: { name: "Puissance", text: "Dégâts de toutes les armes +12 %." },
  haste: { name: "Cadence", text: "Les armes se rechargent 8 % plus vite." },
  regen: { name: "Souffle", text: "Rend 0,5 point de vie par seconde." },
  armor: { name: "Carapace", text: "Dégâts reçus −10 %." },
  wisdom: { name: "Sagesse", text: "Expérience gagnée +12 %." },
};

export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];

export const PASSIVE_BONUS = {
  vigorHp: 20,
  swiftness: 0.08,
  magnet: 0.35,
  might: 0.12,
  haste: 0.08,
  regen: 0.5,
  armor: 0.1,
  wisdom: 0.12,
} as const;

/** Arme de départ. */
export const STARTING_WEAPON: WeaponId = "spark";

/**
 * Déblocages entre les parties, payés en pièces : ils ajoutent une arme ou un passif au tirage.
 * Jamais de bonus permanent : une partie se gagne avec ce qu'on y ramasse.
 */
export const UNLOCKS: ReadonlyArray<{ readonly id: UpgradeId; readonly cost: number }> = [
  { id: "regen", cost: 30 },
  { id: "storm", cost: 50 },
  { id: "armor", cost: 70 },
  { id: "lance", cost: 90 },
  { id: "wisdom", cost: 110 },
];
