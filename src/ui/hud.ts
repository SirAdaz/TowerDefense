import { earlyBonus } from "../game/engine.ts";
import type { GameState } from "../game/types.ts";
import { waveSize } from "../game/waves.ts";
import { formatMoney, requireElement, setAttribute, setText, setUnavailable } from "./dom.ts";

/** Ce que le bandeau et la carte « Vagues » affichent, en plus de l'état de la partie. */
export interface HudView {
  readonly state: GameState;
  readonly record: number;
  readonly isPaused: boolean;
  readonly isFast: boolean;
}

export interface Hud {
  readonly nextWaveButton: HTMLButtonElement;
  readonly pauseButton: HTMLButtonElement;
  readonly speedButton: HTMLButtonElement;
  refresh(view: HudView): void;
}

function waveStatus(state: GameState): string {
  switch (state.phase) {
    case "ready":
      return "Posez vos tourelles, puis lancez la première vague.";
    case "wave": {
      const remaining = waveSize(state.wave) - state.spawnedCount + state.enemies.length;
      return `Vague ${state.wave} en cours : ${remaining} ${remaining > 1 ? "ennemis restants" : "ennemi restant"}.`;
    }
    case "countdown":
      return `Vague ${state.wave + 1} dans ${Math.ceil(state.countdown)} s. La lancer plus tôt rapporte un bonus.`;
    case "over":
      return `Partie terminée à la vague ${state.wave}.`;
  }
}

function nextWaveLabel(state: GameState): string {
  if (state.phase === "ready") {
    return "Lancer la vague 1";
  }
  if (state.phase === "countdown") {
    return `Vague suivante · +${formatMoney(earlyBonus(state))}`;
  }
  return "Vague suivante";
}

/** Relie le bandeau (vague, vies, argent, record) et la carte « Vagues » aux éléments du gabarit. */
export function createHud(): Hud {
  const waveStat = requireElement("stat-wave", HTMLElement);
  const livesStat = requireElement("stat-lives", HTMLElement);
  const moneyStat = requireElement("stat-money", HTMLElement);
  const recordStat = requireElement("stat-record", HTMLElement);
  const status = requireElement("wave-status", HTMLParagraphElement);
  const countdown = requireElement("wave-countdown", HTMLProgressElement);
  const banner = requireElement("board-banner", HTMLParagraphElement);
  const nextWaveButton = requireElement("next-wave", HTMLButtonElement);
  const pauseButton = requireElement("pause", HTMLButtonElement);
  const speedButton = requireElement("speed", HTMLButtonElement);

  return {
    nextWaveButton,
    pauseButton,
    speedButton,
    refresh({ state, record, isPaused, isFast }) {
      setText(waveStat, String(state.wave));
      setText(livesStat, String(state.lives));
      setText(moneyStat, formatMoney(state.money));
      setText(recordStat, String(record));
      setText(status, waveStatus(state));
      setText(nextWaveButton, nextWaveLabel(state));
      setUnavailable(nextWaveButton, state.phase === "wave" || state.phase === "over");
      const isCounting = state.phase === "countdown";
      countdown.hidden = !isCounting;
      if (isCounting) {
        countdown.value = state.countdown;
      }
      setText(pauseButton, isPaused ? "Reprendre" : "Pause");
      setUnavailable(pauseButton, state.phase === "over");
      setAttribute(speedButton, "aria-pressed", String(isFast));
      banner.hidden = !isPaused || state.phase === "over";
    },
  };
}
