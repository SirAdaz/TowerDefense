import { frenchSan } from "./notation.ts";
import type { PlayerColor } from "./types.ts";

/** Numéro d'un demi-coup et son nom : « 12. Cf3 » pour les blancs, « 12… Cf6 » pour les noirs. */
export function moveNumberLabel(ply: { readonly ply: number; readonly san: string }): string {
  const moveNumber = Math.floor(ply.ply / 2) + 1;
  return `${moveNumber}${ply.ply % 2 === 0 ? "." : "…"} ${frenchSan(ply.san)}`;
}

/** Durée courte : « 0,8 s », « 12 s », « 1 min 05 ». */
export function formatSeconds(seconds: number): string {
  if (seconds < 10) {
    return `${seconds.toFixed(1).replace(".", ",")} s`;
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/** Couleur dite en français, au pluriel comme on le dit d'un camp : « blancs », « noirs ». */
export function sideName(color: PlayerColor): string {
  return color === "white" ? "blancs" : "noirs";
}
