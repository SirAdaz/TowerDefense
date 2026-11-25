import type { FetchFailure } from "../data/chesscomApi.ts";
import { GAMES_PER_PASS } from "../game/chesscom.ts";

/** Messages d'erreur de lecture des parties : chacun dit quoi faire ensuite. */
export const FAILURE_MESSAGES: Readonly<Record<FetchFailure, string>> = {
  "not-found": "Ce pseudo est inconnu de chess.com. Vérifiez son orthographe.",
  "rate-limited": "Chess.com limite le nombre de demandes. Réessayez dans une minute.",
  network: "Impossible de joindre chess.com. Vérifiez votre connexion, puis réessayez.",
  unavailable: "Chess.com ne répond pas correctement pour l'instant. Réessayez plus tard.",
};

export const TEXTS = {
  invalidUsername: "Pseudo invalide : 3 à 25 caractères, lettres, chiffres, tirets ou tirets bas.",
  fetching: "Lecture de vos parties sur chess.com…",
  noGames: "Aucune partie en bullet, blitz ou rapide sur les trois derniers mois.",
  upToDate: "Aucune nouvelle partie depuis la dernière analyse.",
  cancelled: "Analyse annulée. Les parties déjà analysées sont gardées.",
  engineFailed: "Le moteur d'analyse n'a pas pu démarrer sur ce navigateur. Rechargez la page, puis réessayez.",
  confirmForget: "Oublier ce pseudo et effacer de ce navigateur ses parties analysées et ses problèmes ?",
  moreToAnalyse: (remainingCount: number) =>
    `Encore ${remainingCount} à analyser : relancez pour les ${Math.min(remainingCount, GAMES_PER_PASS)} suivantes.`,
} as const;
