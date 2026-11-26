import type { KeyValueStore } from "../../shared/storage.ts";
import { setText } from "../../shared/dom.ts";
import { loadIsSoundOn, saveIsSoundOn } from "../game/sounds.ts";
import type { BoardSound } from "../game/sounds.ts";

export interface SoundPlayer {
  /** Joue un son, après `delayMs` si donné. Ne fait rien quand le son est coupé. */
  play(sound: BoardSound, delayMs?: number): void;
}

/** Fichiers servis depuis `public/sons/echecs/` (Kenney, CC0 : voir THIRD-PARTY-NOTICES.md). */
const SOUND_FILES: Readonly<Record<BoardSound, string>> = {
  move: "/sons/echecs/move.mp3",
  capture: "/sons/echecs/capture.mp3",
  check: "/sons/echecs/check.mp3",
  castle: "/sons/echecs/castle.mp3",
  promote: "/sons/echecs/promote.mp3",
  error: "/sons/echecs/error.mp3",
  success: "/sons/echecs/success.mp3",
};

const VOLUME = 0.8;

function toggleLabel(isOn: boolean): string {
  return isOn ? "Couper le son" : "Remettre le son";
}

/**
 * Lecteur des sons du plateau, avec son bouton couper/remettre. Les sons ne partent qu'en réponse à
 * un geste du joueur (coup, bouton) : rien ne joue à l'ouverture de la page. Les fichiers ne sont
 * chargés qu'au premier son.
 */
export function createSoundPlayer(store: KeyValueStore, toggle: HTMLButtonElement): SoundPlayer {
  let isOn = loadIsSoundOn(store);
  const players = new Map<BoardSound, HTMLAudioElement>();

  const render = () => {
    setText(toggle, toggleLabel(isOn));
    toggle.classList.toggle("is-muted", !isOn);
  };
  toggle.addEventListener("click", () => {
    isOn = !isOn;
    saveIsSoundOn(store, isOn);
    render();
  });
  render();

  const playNow = (sound: BoardSound) => {
    const audio = players.get(sound) ?? new Audio(SOUND_FILES[sound]);
    players.set(sound, audio);
    audio.volume = VOLUME;
    audio.currentTime = 0;
    audio.play().catch((error: unknown) => {
      console.warn("Son refusé par le navigateur", error);
    });
  };

  return {
    play: (sound, delayMs = 0) => {
      if (!isOn) {
        return;
      }
      if (delayMs > 0) {
        window.setTimeout(() => {
          playNow(sound);
        }, delayMs);
      } else {
        playNow(sound);
      }
    },
  };
}
