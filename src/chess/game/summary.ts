import type { KeyValueStore } from "../../shared/storage.ts";
import { normalizeUsername } from "./chesscom.ts";
import type { Puzzle } from "./types.ts";

/** Le pseudo ne quitte jamais ce navigateur : il n'est écrit que dans son stockage local. */
export const USERNAME_KEY = "echecs.username.v1";

/** Nombre de problèmes déjà réussis : relu par l'accueil, qui n'ouvre pas la base de la page. */
export const SOLVED_COUNT_KEY = "echecs.solved.v1";

export function loadUsername(store: KeyValueStore): string | null {
  try {
    const stored = store.getItem(USERNAME_KEY);
    return stored === null ? null : normalizeUsername(stored);
  } catch {
    return null;
  }
}

/** Une écriture refusée (quota, navigation privée) ne doit pas casser la page : elle est ignorée. */
function tryWrite(write: () => void): boolean {
  try {
    write();
    return true;
  } catch {
    return false;
  }
}

/** Renvoie faux si le navigateur a refusé de garder le pseudo. */
export function saveUsername(store: KeyValueStore, username: string): boolean {
  return tryWrite(() => {
    store.setItem(USERNAME_KEY, username);
  });
}

export function forgetUsername(store: KeyValueStore): void {
  tryWrite(() => {
    store.removeItem(USERNAME_KEY);
    store.removeItem(SOLVED_COUNT_KEY);
  });
}

/** Un problème compte comme réussi dès qu'il a été trouvé une fois sans indice. */
export function countSolved(puzzles: readonly Puzzle[]): number {
  return puzzles.filter((puzzle) => puzzle.review.successes > 0).length;
}

export function saveSolvedCount(store: KeyValueStore, solvedCount: number): void {
  tryWrite(() => {
    store.setItem(SOLVED_COUNT_KEY, String(solvedCount));
  });
}

/** Ligne affichée sur la carte de l'accueil, ou `null` tant qu'aucun problème n'est réussi. */
export function describeChessRecord(store: KeyValueStore): string | null {
  const solvedCount = Number(store.getItem(SOLVED_COUNT_KEY));
  if (!Number.isSafeInteger(solvedCount) || solvedCount <= 0) {
    return null;
  }
  return solvedCount === 1 ? "1 problème réussi" : `${solvedCount} problèmes réussis`;
}
