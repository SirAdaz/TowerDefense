import { GAMES_PER_PASS, archivesUrl, parseArchiveGames, parseArchiveList, selectGamesToAnalyse } from "../game/chesscom.ts";
import type { GameSelection } from "../game/chesscom.ts";
import type { RawGame } from "../game/types.ts";

/** Pourquoi la lecture des parties a échoué : chaque cas a son message pour le joueur. */
export type FetchFailure = "not-found" | "rate-limited" | "network" | "unavailable";

export class ChessComError extends Error {
  readonly reason: FetchFailure;

  constructor(reason: FetchFailure) {
    super(`chess.com request failed: ${reason}`);
    this.name = "ChessComError";
    this.reason = reason;
  }
}

/** On ne remonte pas plus loin que trois mois d'archives : une requête par mois, l'API limite le débit. */
const MAX_ARCHIVE_MONTHS = 3;

const FAILURE_BY_STATUS: Readonly<Record<number, FetchFailure>> = { 404: "not-found", 410: "not-found", 429: "rate-limited" };

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Lit une ressource JSON de l'API publique. Requête simple, sans identifiant ni en-tête maison :
 * rien d'autre que l'adresse (donc le pseudo) ne part vers le site.
 */
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new ChessComError("network");
  }
  if (!response.ok) {
    throw new ChessComError(FAILURE_BY_STATUS[response.status] ?? "unavailable");
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ChessComError("unavailable");
  }
}

function hasReachedHistory(games: readonly RawGame[], sinceEndTime: number | null): boolean {
  if (sinceEndTime === null) {
    return games.length >= GAMES_PER_PASS;
  }
  return games.some((game) => game.endTime <= sinceEndTime);
}

/**
 * Parties à analyser pour ce joueur : remonte les archives mensuelles une à une (les requêtes en
 * parallèle déclenchent la limite de débit du site) et s'arrête dès qu'elle rejoint ce qui est connu.
 */
export async function fetchGamesToAnalyse(
  username: string,
  analysedIds: ReadonlySet<string>,
  sinceEndTime: number | null,
  signal: AbortSignal,
): Promise<GameSelection> {
  const archiveUrls = parseArchiveList(await fetchJson(archivesUrl(username), signal), username);
  const games: RawGame[] = [];
  for (const archiveUrl of archiveUrls.slice(0, MAX_ARCHIVE_MONTHS)) {
    games.push(...parseArchiveGames(await fetchJson(archiveUrl, signal), username));
    if (hasReachedHistory(games, sinceEndTime)) {
      break;
    }
  }
  return selectGamesToAnalyse(games, analysedIds, sinceEndTime);
}
