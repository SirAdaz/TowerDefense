import type { KeyValueStore } from "../../shared/storage.ts";

/** Sons d'un coup, du plus banal au plus marquant. */
export type MoveSound = "move" | "capture" | "check" | "castle" | "promote";

/** Tous les sons de la page : ceux des coups, puis l'erreur et la réussite d'un problème. */
export type BoardSound = MoveSound | "error" | "success";

/** Choix du son : couper ou remettre, gardé dans ce navigateur. */
export const SOUND_KEY = "echecs.sound.v1";

const SOUND_OFF = "off";

/**
 * Son d'un coup d'après sa notation et les drapeaux de chess.js (`c` prise, `e` en passant, `k`/`q`
 * roques, `p` promotion). Un seul son par coup, comme sur les sites d'échecs : l'échec l'emporte,
 * puis la promotion, le roque et la prise.
 */
export function moveSoundOf(san: string, flags: string): MoveSound {
  if (/[+#]$/.test(san)) {
    return "check";
  }
  if (flags.includes("p")) {
    return "promote";
  }
  if (flags.includes("k") || flags.includes("q")) {
    return "castle";
  }
  if (flags.includes("c") || flags.includes("e")) {
    return "capture";
  }
  return "move";
}

/** Le son est actif par défaut ; un stockage illisible (navigation privée) le laisse actif. */
export function loadIsSoundOn(store: KeyValueStore): boolean {
  try {
    return store.getItem(SOUND_KEY) !== SOUND_OFF;
  } catch {
    return true;
  }
}

/** Renvoie faux si le navigateur refuse de garder le choix : il vaut alors le temps de l'onglet. */
export function saveIsSoundOn(store: KeyValueStore, isOn: boolean): boolean {
  try {
    store.setItem(SOUND_KEY, isOn ? "on" : SOUND_OFF);
    return true;
  } catch {
    return false;
  }
}
