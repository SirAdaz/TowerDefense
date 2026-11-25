import type { Profile } from "../game/profile.ts";

/**
 * Mise en forme des nombres, durées et du record. Ce module ne dépend pas des tables du jeu :
 * la page d'accueil l'importe pour afficher le record sans charger le jeu.
 */
const numberFormat = new Intl.NumberFormat("fr-FR");

/** Nombre avec séparateur de milliers français. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Durée en minutes:secondes. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatCoins(coins: number): string {
  return `${formatNumber(coins)} ${coins > 1 ? "pièces" : "pièce"}`;
}

/** Record du joueur en une ligne (menu du jeu et carte de l'accueil), ou `null` s'il n'a jamais joué. */
export function describeRecord(profile: Profile): string | null {
  if (profile.bestScore <= 0) {
    return null;
  }
  const night = profile.hasWon ? "aube atteinte" : `tenu ${formatTime(profile.bestSeconds)}`;
  return `Record : ${formatNumber(profile.bestScore)} points · ${night}`;
}
