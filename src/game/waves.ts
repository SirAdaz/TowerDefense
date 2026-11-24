import {
  BASE_ENEMY_COUNT,
  BOSS_EVERY,
  ENEMY_COUNT_PER_WAVE,
  ENEMY_STATS,
  FAST_FROM_WAVE,
  HP_GROWTH,
  MAX_ENEMY_COUNT,
  SPAWN_INTERVAL_DROP_PER_WAVE,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_START,
  TANK_EVERY,
  TANK_FROM_WAVE,
  type EnemyKind,
} from "./balance.ts";

/** Vrai si la vague se termine par un boss. */
export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_EVERY === 0;
}

/** Nombre d'ennemis ordinaires de la vague (le boss éventuel vient en plus). */
export function regularEnemyCount(wave: number): number {
  return Math.min(BASE_ENEMY_COUNT + ENEMY_COUNT_PER_WAVE * wave, MAX_ENEMY_COUNT);
}

/** Nombre total d'ennemis de la vague, boss compris. */
export function waveSize(wave: number): number {
  return regularEnemyCount(wave) + (isBossWave(wave) ? 1 : 0);
}

/**
 * Sorte du n-ième ennemi de la vague (index à partir de 0). Sans hasard : une vague se rejoue à
 * l'identique, ce qui rend la sauvegarde et l'équilibrage vérifiables. Les rapides ferment la marche
 * en peloton (dernier tiers), les costauds sont répartis, le boss entre en dernier.
 */
export function enemyKindAt(wave: number, index: number): EnemyKind {
  const regularCount = regularEnemyCount(wave);
  if (index >= regularCount) {
    return "boss";
  }
  if (wave >= TANK_FROM_WAVE && index % TANK_EVERY === TANK_EVERY - 1) {
    return "tank";
  }
  const firstFastIndex = regularCount - Math.floor(regularCount / 3);
  if (wave >= FAST_FROM_WAVE && index >= firstFastIndex) {
    return "fast";
  }
  return "normal";
}

/** Secondes entre deux entrées d'ennemis : de plus en plus serrées, avec un plancher. */
export function spawnInterval(wave: number): number {
  return Math.max(SPAWN_INTERVAL_START - SPAWN_INTERVAL_DROP_PER_WAVE * (wave - 1), SPAWN_INTERVAL_MIN);
}

/** Vie d'un ennemi à une vague donnée : la vie de base, multipliée par HP_GROWTH à chaque vague. */
export function enemyMaxHp(kind: EnemyKind, wave: number): number {
  return Math.round(ENEMY_STATS[kind].baseHp * HP_GROWTH ** (wave - 1));
}
