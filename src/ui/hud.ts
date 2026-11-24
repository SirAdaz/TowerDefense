import { earlyCallBonus } from "../game/game.ts";
import type { GameState } from "../game/types.ts";
import { byId, setAttr, setDisabled, setText } from "./dom.ts";

export interface HudElements {
  readonly lives: HTMLElement;
  readonly money: HTMLElement;
  readonly wave: HTMLElement;
  readonly record: HTMLElement;
  readonly countdown: HTMLElement;
  readonly nextWave: HTMLButtonElement;
  readonly speed: HTMLButtonElement;
  readonly pause: HTMLButtonElement;
}

export interface HudInfo {
  readonly state: GameState;
  readonly record: number;
  readonly isPaused: boolean;
  readonly isFast: boolean;
}

export function getHud(): HudElements {
  return {
    lives: byId("lives"),
    money: byId("money"),
    wave: byId("wave"),
    record: byId("record"),
    countdown: byId("countdown"),
    nextWave: byId("next-wave"),
    speed: byId("speed"),
    pause: byId("pause"),
  };
}

function nextWaveLabel(state: GameState): string {
  if (state.phase === "gameOver") return "Partie finie";
  if (state.phase === "wave") return `Vague ${state.wave} en cours`;
  if (state.wave === 0) return "Lancer la vague 1";
  return `Vague ${state.wave + 1} (+${earlyCallBonus(state)} $)`;
}

function countdownLabel(state: GameState): string {
  if (state.phase !== "intermission" || state.intermissionLeft === null) return "";
  return `Prochaine vague dans ${Math.ceil(state.intermissionLeft)} s`;
}

/** Met à jour le bandeau (appelée à chaque image, n'écrit que ce qui change). */
export function renderHud(hud: HudElements, info: HudInfo): void {
  const { state } = info;
  setText(hud.lives, String(state.lives));
  setText(hud.money, `${state.money} $`);
  setText(hud.wave, String(state.wave));
  setText(hud.record, String(info.record));
  setText(hud.countdown, countdownLabel(state));
  setText(hud.nextWave, nextWaveLabel(state));
  setDisabled(hud.nextWave, state.phase !== "intermission" || info.isPaused);
  setAttr(hud.speed, "aria-pressed", String(info.isFast));
  setAttr(hud.speed, "aria-label", info.isFast ? "Vitesse ×2 activée" : "Vitesse ×2");
  setText(hud.pause, info.isPaused ? "Reprendre" : "Pause");
  setAttr(hud.pause, "aria-pressed", String(info.isPaused));
  setDisabled(hud.pause, state.phase === "gameOver");
}
