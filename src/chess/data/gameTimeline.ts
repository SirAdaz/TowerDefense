import { parseGame } from "../game/pgn.ts";
import type { AnalysedGame, GameTimeline } from "../game/types.ts";
import { scoreGame } from "./analyser.ts";
import { ChessComError, fetchGame } from "./chesscomApi.ts";
import type { Engine } from "./engine.ts";
import type { ChessStore } from "./store.ts";

export interface TimelineOptions {
  readonly store: ChessStore;
  readonly startEngine: () => Promise<Engine>;
  readonly signal: AbortSignal;
  /** Positions évaluées sur le total, pour la barre de progression. */
  readonly onProgress: (done: number, total: number) => void;
}

/**
 * Revue d'une partie analysée avant qu'on garde les évaluations coup par coup : la partie est relue
 * dans l'archive de son mois, réévaluée (une passe rapide, une minute environ sur téléphone), puis
 * gardée pour les ouvertures suivantes.
 */
export async function rebuildTimeline(game: AnalysedGame, options: TimelineOptions): Promise<GameTimeline> {
  const rawGame = await fetchGame(game.username, game.id, game.endTime, options.signal);
  const parsed = rawGame === null ? null : parseGame(rawGame.pgn);
  if (rawGame === null || parsed === null) {
    throw new ChessComError("not-found");
  }
  const engine = await options.startEngine();
  const total = parsed.moves.length + 1;
  let done = 0;
  const stop = () => {
    engine.dispose();
  };
  options.signal.addEventListener("abort", stop);
  try {
    const timeline = await scoreGame(engine, rawGame.pgn, parsed, {
      signal: options.signal,
      onPosition: () => {
        done += 1;
        options.onProgress(done, total);
      },
    });
    await options.store.saveGame({ ...game, timeline });
    return timeline;
  } finally {
    options.signal.removeEventListener("abort", stop);
    engine.dispose();
  }
}
