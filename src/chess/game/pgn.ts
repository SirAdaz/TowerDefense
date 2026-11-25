import { Chess } from "chess.js";
import type { GamePhase, ParsedGame, ParsedMove } from "./types.ts";

/** Horloge notée par le site après chaque coup : `[%clk 0:02:58.9]`. */
const CLOCK_PATTERN = /\[%clk (\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/g;

/** Mots qui terminent le nom de famille d'une ouverture dans l'adresse fournie par le site. */
const OPENING_FAMILY_END = /^(.*?\b(?:Defense|Opening|Game|Gambit|Attack|System|Countergambit))\b/;

const OPENING_FALLBACK_WORDS = 3;

/** L'ouverture s'arrête au 12e coup : au-delà, la théorie d'un joueur de club est épuisée. */
const OPENING_LAST_PLY = 24;

/** Six pièces (hors rois et pions) ou moins : finale. */
const ENDGAME_MAX_PIECES = 6;

export const UNKNOWN_OPENING = "Ouverture inconnue";

/** Pendules du PGN, dans l'ordre des demi-coups, en secondes. */
export function parseClocks(pgn: string): number[] {
  const clocks: number[] = [];
  for (const match of pgn.matchAll(CLOCK_PATTERN)) {
    clocks.push(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
  }
  return clocks;
}

/**
 * Nom de famille d'une ouverture à partir de l'adresse du PGN (`…/openings/Sicilian-Defense-Open-2…Nc6`).
 * On regroupe par famille : au niveau de la variante exacte, chaque ligne n'aurait qu'une partie.
 */
export function openingFamily(ecoUrl: string | undefined): string {
  const slug = ecoUrl?.split("/openings/")[1];
  if (slug === undefined || slug === "") {
    return UNKNOWN_OPENING;
  }
  const words = slug.replace(/-\d.*$/, "").split("-").join(" ");
  const family = OPENING_FAMILY_END.exec(words);
  if (family?.[1] !== undefined) {
    return family[1];
  }
  return words.split(" ").slice(0, OPENING_FALLBACK_WORDS).join(" ");
}

/** Phase de la partie pour une position : sert à dire où les parties se perdent. */
export function phaseOf(fen: string, ply: number): GamePhase {
  const board = fen.split(" ")[0] ?? "";
  const pieceCount = board.replace(/[^nbrqNBRQ]/g, "").length;
  if (pieceCount <= ENDGAME_MAX_PIECES) {
    return "endgame";
  }
  return ply < OPENING_LAST_PLY ? "opening" : "middlegame";
}

/**
 * Rejoue un PGN et renvoie chaque demi-coup avec sa position de départ, ou `null` si le PGN est
 * illisible ou ne part pas de la position initiale (variantes, positions imposées).
 */
export function parseGame(pgn: string): ParsedGame | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const headers = chess.getHeaders();
  if (headers["SetUp"] === "1" || headers["FEN"] !== undefined) {
    return null;
  }
  const history = chess.history({ verbose: true });
  const clocks = parseClocks(pgn);
  const hasClocks = clocks.length === history.length;
  const moves: ParsedMove[] = history.map((move, index) => ({
    san: move.san,
    uci: move.lan,
    fenBefore: move.before,
    color: move.color === "w" ? "white" : "black",
    clockSeconds: hasClocks ? (clocks[index] ?? null) : null,
  }));
  return {
    moves,
    finalFen: chess.fen(),
    openingName: openingFamily(headers["ECOUrl"]),
    eco: headers["ECO"] ?? "",
  };
}
