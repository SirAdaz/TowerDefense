import { STEP_SECONDS } from "../game/balance.ts";
import { createGame, step } from "../game/engine.ts";
import type { Cell } from "../game/grid.ts";
import { clearSnapshot, loadSnapshot, readRecord, saveSnapshot, type KeyValueStore } from "../game/save.ts";
import type { GameEvent, GameState } from "../game/types.ts";

/** Partie en cours et réglages d'interface qui l'entourent. */
export interface Session {
  state: GameState;
  isPaused: boolean;
  isFast: boolean;
  record: number;
  /** Record à battre par la partie en cours : sert à dire « nouveau record » à la fin. */
  recordAtStart: number;
  selectedTowerId: number | null;
  hoveredCell: Cell | null;
  /** Temps de jeu accumulé, pas encore converti en pas de simulation. */
  pendingSeconds: number;
}

/** Au-delà, l'onglet a été figé (veille, débogueur) : on n'essaie pas de rattraper le temps perdu. */
const MAX_FRAME_SECONDS = 0.25;
const FAST_FACTOR = 2;

/** Reprend la partie sauvegardée, en pause si elle était lancée, ou en démarre une neuve. */
export function openSession(store: KeyValueStore): Session {
  const snapshot = loadSnapshot(store);
  const state = snapshot?.state ?? createGame();
  const record = readRecord(store);
  return {
    state,
    isPaused: state.phase !== "ready",
    isFast: snapshot?.isFast ?? false,
    record,
    recordAtStart: Math.min(record, Math.max(state.wave - 1, 0)),
    selectedTowerId: null,
    hoveredCell: null,
    pendingSeconds: 0,
  };
}

/** Remet la session sur une partie neuve. Le record et le réglage de vitesse sont gardés. */
export function resetSession(session: Session): void {
  session.state = createGame();
  session.recordAtStart = session.record;
  session.isPaused = false;
  session.selectedTowerId = null;
  session.pendingSeconds = 0;
}

/** Écrit la partie, ou efface la sauvegarde si elle est perdue : on ne reprend pas une défaite. */
export function persistSession(session: Session, store: KeyValueStore): void {
  if (session.state.phase === "over") {
    clearSnapshot(store);
    return;
  }
  saveSnapshot(store, { state: session.state, isFast: session.isFast });
}

/**
 * Convertit le temps écoulé depuis la dernière image en pas fixes de simulation. En ×2, le temps de
 * jeu passe deux fois plus vite : deux fois plus de pas, chacun identique à la vitesse normale.
 */
export function advanceSession(session: Session, elapsedSeconds: number): GameEvent[] {
  if (session.isPaused || session.state.phase === "over") {
    session.pendingSeconds = 0;
    return [];
  }
  const speed = session.isFast ? FAST_FACTOR : 1;
  session.pendingSeconds += Math.min(elapsedSeconds, MAX_FRAME_SECONDS) * speed;
  const events: GameEvent[] = [];
  while (session.pendingSeconds >= STEP_SECONDS) {
    session.pendingSeconds -= STEP_SECONDS;
    events.push(...step(session.state));
  }
  return events;
}
