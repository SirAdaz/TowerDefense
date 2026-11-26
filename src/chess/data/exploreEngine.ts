import type { EngineLine } from "../game/types.ts";
import type { Engine, SearchLimits } from "./engine.ts";

/** Recherche courte : le moteur répond en moins d'une demi-seconde, assez pour comprendre une idée. */
export const EXPLORE_SEARCH: SearchLimits = { depth: 14, moveTimeMs: 400, multiPv: 1 };

export interface ExploreEngine {
  /** Meilleure variante de la position, ou `null` s'il n'y en a pas (mat, pat). Rejette si le moteur ne démarre pas. */
  bestLine(fen: string): Promise<EngineLine | null>;
  /** Variantes de la position avec d'autres limites (adversaire affaibli), la meilleure en premier. */
  search(fen: string, limits: SearchLimits): Promise<EngineLine[]>;
}

/**
 * Moteur de l'exploration : un seul Web Worker Stockfish, lancé au premier besoin puis gardé. Les
 * demandes passent l'une après l'autre (le moteur ne cherche qu'une position à la fois).
 */
export function createExploreEngine(startEngine: () => Promise<Engine>): ExploreEngine {
  let engine: Promise<Engine> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const getEngine = () => {
    engine ??= startEngine();
    // Un démarrage raté (WebAssembly bloqué) est retenté à la demande suivante.
    engine.catch(() => {
      engine = null;
    });
    return engine;
  };
  const search = (fen: string, limits: SearchLimits) => {
    const pending = queue.then(async () => (await getEngine()).analyse(fen, limits));
    queue = pending.catch(() => null);
    return pending;
  };
  return {
    bestLine: async (fen) => (await search(fen, EXPLORE_SEARCH))[0] ?? null,
    search,
  };
}
