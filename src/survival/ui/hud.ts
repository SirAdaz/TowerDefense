import { requireElement, setText } from "../../shared/dom.ts";
import { finalScore } from "../game/engine.ts";
import type { GameState } from "../game/types.ts";
import { formatNumber, formatTime } from "./format.ts";

export interface Hud {
  readonly pauseButton: HTMLButtonElement;
  /** Affiche le bandeau pendant une partie, le cache au menu. */
  setVisible(isVisible: boolean): void;
  refresh(state: GameState): void;
}

/** Met à jour une jauge seulement si elle change : la page n'est pas retouchée 60 fois par seconde. */
function setProgress(progressBar: HTMLProgressElement, value: number, max: number): void {
  if (progressBar.max !== max) {
    progressBar.max = max;
  }
  if (progressBar.value !== value) {
    progressBar.value = value;
  }
}

/** Relie le bandeau de `nuit-blanche/index.html` à l'état de la partie. */
export function createHud(): Hud {
  const root = requireElement("hud", HTMLElement);
  const hpBar = requireElement("hp", HTMLProgressElement);
  const hpText = requireElement("hp-text", HTMLElement);
  const time = requireElement("time", HTMLElement);
  const score = requireElement("score", HTMLElement);
  const kills = requireElement("kills", HTMLElement);
  const level = requireElement("level", HTMLElement);
  const xpBar = requireElement("xp", HTMLProgressElement);

  return {
    pauseButton: requireElement("pause", HTMLButtonElement),
    setVisible(isVisible) {
      root.hidden = !isVisible;
    },
    refresh(state) {
      const hp = Math.ceil(state.player.hp);
      setProgress(hpBar, hp, state.stats.maxHp);
      setText(hpText, String(hp));
      setText(time, formatTime(state.time));
      setText(score, formatNumber(finalScore(state)));
      setText(kills, formatNumber(state.kills));
      setText(level, `Niveau ${state.player.level}`);
      setProgress(xpBar, Math.round((state.player.xp / state.player.xpToNext) * 100), 100);
    },
  };
}
