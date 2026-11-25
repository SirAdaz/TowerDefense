/** Porteur de l'état du générateur (l'état de la partie). */
interface RandomSource {
  rngState: number;
}

/**
 * Nombre pseudo-aléatoire dans [0, 1) (mulberry32). L'état vit dans la partie : la même graine et
 * les mêmes entrées rejouent exactement la même nuit, ce qui rend l'équilibrage testable.
 */
export function nextRandom(source: RandomSource): number {
  source.rngState = (source.rngState + 0x6d2b79f5) | 0;
  let mixed = Math.imul(source.rngState ^ (source.rngState >>> 15), 1 | source.rngState);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

/** Entier pseudo-aléatoire dans [0, count). */
export function nextIndex(source: RandomSource, count: number): number {
  return Math.floor(nextRandom(source) * count);
}
