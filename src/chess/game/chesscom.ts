import type { GameResult, PlayerColor, RawGame, TimeClass } from "./types.ts";

export const API_ROOT = "https://api.chess.com/pub/player";

/** Parties analysées par passe : au-delà, l'attente devient trop longue sur téléphone. */
export const GAMES_PER_PASS = 20;

/** Une partie de moins de 5 coups par camp (abandon, déconnexion) n'apprend rien. */
export const MIN_PLIES = 10;

const USERNAME_PATTERN = /^[a-z0-9_-]{3,25}$/;

const ARCHIVE_PATH_PATTERN = /\/games\/\d{4}\/\d{2}$/;

const TIME_CLASSES: readonly string[] = ["bullet", "blitz", "rapid"];

/** Codes de résultat du site qui valent une nulle ; `win` mis à part, tout le reste est une défaite. */
const DRAW_CODES: readonly string[] = ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"];

type JsonRecord = Record<string, unknown>;

function isRecord(candidate: unknown): candidate is JsonRecord {
  return typeof candidate === "object" && candidate !== null;
}

function readString(record: JsonRecord, key: string): string | null {
  const field = record[key];
  return typeof field === "string" ? field : null;
}

/** Pseudo en minuscules, ou `null` s'il ne peut pas exister : il est inséré dans une adresse. */
export function normalizeUsername(input: string): string | null {
  const username = input.trim().toLowerCase();
  return USERNAME_PATTERN.test(username) ? username : null;
}

export function archivesUrl(username: string): string {
  return `${API_ROOT}/${username}/games/archives`;
}

/** Archive du mois (UTC) où une partie s'est terminée : de quoi la relire sans parcourir tout l'historique. */
export function monthArchiveUrl(username: string, endTime: number): string {
  const end = new Date(endTime * 1000);
  const month = String(end.getUTCMonth() + 1).padStart(2, "0");
  return `${API_ROOT}/${username}/games/${end.getUTCFullYear()}/${month}`;
}

/**
 * Adresses des archives mensuelles, de la plus récente à la plus ancienne. Seules celles du joueur
 * sur l'API officielle sont gardées : on ne suit pas une adresse arbitraire venue d'une réponse.
 */
export function parseArchiveList(payload: unknown, username: string): string[] {
  const archives = isRecord(payload) ? payload["archives"] : null;
  if (!Array.isArray(archives)) {
    return [];
  }
  const prefix = `${API_ROOT}/${username}/games/`;
  return archives
    .filter((url): url is string => typeof url === "string")
    .filter((url) => url.toLowerCase().startsWith(prefix) && ARCHIVE_PATH_PATTERN.test(url))
    .reverse();
}

function toResult(code: string): GameResult {
  if (code === "win") {
    return "win";
  }
  return DRAW_CODES.includes(code) ? "draw" : "loss";
}

function playerSide(game: JsonRecord, username: string): { color: PlayerColor; result: GameResult } | null {
  for (const color of ["white", "black"] as const) {
    const side = game[color];
    if (isRecord(side) && readString(side, "username")?.toLowerCase() === username) {
      const resultCode = readString(side, "result");
      return resultCode === null ? null : { color, result: toResult(resultCode) };
    }
  }
  return null;
}

function readTimeClass(entry: JsonRecord): TimeClass | null {
  const timeClass = readString(entry, "time_class");
  return timeClass !== null && TIME_CLASSES.includes(timeClass) ? (timeClass as TimeClass) : null;
}

/** Adresse de la partie, seulement si elle pointe bien vers le site : elle devient un lien cliquable. */
function readGameUrl(entry: JsonRecord): string | null {
  const url = readString(entry, "url");
  return url?.startsWith("https://www.chess.com/") === true ? url : null;
}

function parseGameEntry(entry: unknown, username: string): RawGame | null {
  if (!isRecord(entry) || entry["rules"] !== "chess") {
    return null;
  }
  const url = readGameUrl(entry);
  const pgn = readString(entry, "pgn");
  const timeClass = readTimeClass(entry);
  const endTime = entry["end_time"];
  const side = playerSide(entry, username);
  if (url === null || pgn === null || timeClass === null || typeof endTime !== "number" || side === null) {
    return null;
  }
  const id = readString(entry, "uuid") ?? url;
  return { id, url, pgn, timeClass, endTime, playerColor: side.color, result: side.result };
}

/** Parties d'une archive mensuelle : échecs classiques en bullet, blitz ou rapide, où le joueur figure. */
export function parseArchiveGames(payload: unknown, username: string): RawGame[] {
  const games = isRecord(payload) ? payload["games"] : null;
  if (!Array.isArray(games)) {
    return [];
  }
  return games.map((entry) => parseGameEntry(entry, username)).filter((game) => game !== null);
}

export interface GameSelection {
  /** Parties à analyser dans cette passe, de la plus récente à la plus ancienne. */
  readonly selected: readonly RawGame[];
  /** Parties nouvelles laissées pour une prochaine passe. */
  readonly remainingCount: number;
}

/**
 * Choisit les parties d'une passe : celles jamais analysées et jouées après `sinceEndTime` (la plus
 * ancienne partie de la toute première passe ; `null` à la première visite), les plus récentes
 * d'abord, `limit` au plus. On n'analyse donc jamais l'historique d'avant la première visite.
 */
export function selectGamesToAnalyse(
  games: readonly RawGame[],
  analysedIds: ReadonlySet<string>,
  sinceEndTime: number | null,
  limit: number = GAMES_PER_PASS,
): GameSelection {
  const fresh = games
    .filter((game) => !analysedIds.has(game.id))
    .filter((game) => sinceEndTime === null || game.endTime > sinceEndTime)
    .sort((a, b) => b.endTime - a.endTime);
  const selected = fresh.slice(0, limit);
  const remainingCount = sinceEndTime === null ? 0 : fresh.length - selected.length;
  return { selected, remainingCount };
}
