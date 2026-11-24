import { BALANCE, ENEMY_PROFILES } from "./balance.ts";
import type { Enemy, EnemyKind } from "./types.ts";

/** Première vague où apparaissent les rapides, puis les costauds. */
export const FAST_FROM_WAVE = 3;
export const TANK_FROM_WAVE = 5;
const MAX_REGULAR_ENEMIES = 60;

/** Vrai pour les vagues 10, 20, 30… : un boss ferme la vague. */
export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BALANCE.bossEvery === 0;
}

/** Nombre d'ennemis ordinaires (hors boss) : 5 + 2 par vague, plafonné à 60. */
export function regularEnemyCount(wave: number): number {
  return Math.min(5 + 2 * wave, MAX_REGULAR_ENEMIES);
}

function kindAt(index: number, wave: number): EnemyKind {
  if (wave >= TANK_FROM_WAVE && index % 5 === 4) return "tank";
  if (wave >= FAST_FROM_WAVE && index % 3 === 2) return "fast";
  return "normal";
}

/**
 * Ordre d'entrée des ennemis d'une vague. Déterministe (pas de hasard) : une même vague se rejoue
 * à l'identique, ce qui rend l'équilibrage testable. Le boss entre en dernier.
 */
export function waveComposition(wave: number): EnemyKind[] {
  const kinds = Array.from({ length: regularEnemyCount(wave) }, (_, index) => kindAt(index, wave));
  if (isBossWave(wave)) kinds.push("boss");
  return kinds;
}

/** Secondes entre deux entrées : 0,9 s à la vague 1, puis de plus en plus serré jusqu'à 0,45 s. */
export function spawnInterval(wave: number): number {
  return Math.max(0.45, 0.9 - 0.02 * (wave - 1));
}

/** Multiplicateur de vie d'une vague : ×1,15 par vague (vague 1 = ×1). */
export function hpScale(wave: number): number {
  return BALANCE.hpGrowthPerWave ** (wave - 1);
}

/** Crée un ennemi à l'entrée du chemin, avec la vie de sa vague. */
export function createEnemy(kind: EnemyKind, wave: number, id: number): Enemy {
  const profile = ENEMY_PROFILES[kind];
  const maxHp = Math.round(profile.baseHp * hpScale(wave));
  return { id, kind, hp: maxHp, maxHp, speed: profile.speed, reward: profile.reward, distance: 0 };
}
