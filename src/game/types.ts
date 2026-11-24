import type { EnemyKind, Gauge } from "./balance.ts";
import type { Point } from "./grid.ts";

/**
 * `ready` : avant la vague 1, on attend le clic. `wave` : des ennemis entrent ou sont sur la carte.
 * `countdown` : entre deux vagues. `over` : plus de vies.
 */
export type Phase = "ready" | "wave" | "countdown" | "over";

export type GaugeLevels = Record<Gauge, number>;

export interface Tower {
  id: number;
  col: number;
  row: number;
  /** Niveau de chaque jauge, de 1 à MAX_LEVEL. */
  levels: GaugeLevels;
  /** Secondes avant le prochain tir possible. */
  cooldown: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Distance parcourue sur le chemin, en cases. */
  distance: number;
}

/**
 * État complet d'une partie : du JSON pur, sans horloge ni hasard. Le sauvegarder tel quel puis le
 * recharger redonne exactement la même partie, ennemis en route compris.
 */
export interface GameState {
  phase: Phase;
  /** Numéro de la dernière vague lancée (0 avant la première) : c'est le score. */
  wave: number;
  lives: number;
  money: number;
  towers: Tower[];
  enemies: Enemy[];
  /** Nombre d'ennemis de la vague en cours déjà entrés. */
  spawnedCount: number;
  /** Secondes avant la prochaine entrée d'ennemi. */
  spawnTimer: number;
  /** Secondes avant le départ automatique de la vague suivante (phase `countdown`). */
  countdown: number;
  nextId: number;
}

/** Ce qui s'est passé pendant un pas : le rendu et l'interface s'en servent, la logique n'en dépend pas. */
export type GameEvent =
  | { type: "waveStarted"; wave: number; bonus: number }
  | { type: "shot"; towerId: number; from: Point; to: Point }
  | { type: "killed"; kind: EnemyKind; at: Point; bounty: number }
  | { type: "leaked"; kind: EnemyKind; livesLost: number }
  | { type: "waveCleared"; wave: number }
  | { type: "gameOver"; wave: number };
