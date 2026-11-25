import type { AnalysedGame, Puzzle } from "../game/types.ts";

/** Ce que la page garde d'une visite à l'autre : parties analysées et problèmes, par pseudo. */
export interface ChessStore {
  /** Faux quand le navigateur refuse IndexedDB (navigation privée) : tout est perdu à la fermeture. */
  readonly isPersistent: boolean;
  listGames(username: string): Promise<AnalysedGame[]>;
  saveGame(game: AnalysedGame): Promise<void>;
  listPuzzles(username: string): Promise<Puzzle[]>;
  savePuzzle(puzzle: Puzzle): Promise<void>;
  clearUser(username: string): Promise<void>;
}

const DATABASE_NAME = "echecs";
const DATABASE_VERSION = 1;
const GAMES = "games";
const PUZZLES = "puzzles";

type StoreName = typeof GAMES | typeof PUZZLES;

/** Clé d'un enregistrement : le pseudo d'abord, pour lister ou effacer tout un joueur d'un coup. */
function recordKey(username: string, id: string): string {
  return `${username}|${id}`;
}

function userRange(username: string): IDBKeyRange {
  return IDBKeyRange.bound(`${username}|`, `${username}|￿`);
}

function settle<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    for (const storeName of [GAMES, PUZZLES]) {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    }
  };
  return settle(request);
}

function indexedDbStore(database: IDBDatabase): ChessStore {
  const objectStore = (storeName: StoreName, mode: IDBTransactionMode) =>
    database.transaction(storeName, mode).objectStore(storeName);
  // Une lecture ou une écriture ratée (quota, base fermée) ne doit jamais casser la page : on continue sans.
  const listAll = async <RecordType>(storeName: StoreName, username: string): Promise<RecordType[]> => {
    try {
      return (await settle(objectStore(storeName, "readonly").getAll(userRange(username)))) as RecordType[];
    } catch (error) {
      console.warn("Lecture de la base impossible", error);
      return [];
    }
  };
  const put = async (storeName: StoreName, key: string, stored: AnalysedGame | Puzzle) => {
    try {
      await settle(objectStore(storeName, "readwrite").put(stored, key));
    } catch (error) {
      console.warn("Écriture dans la base impossible", error);
    }
  };
  return {
    isPersistent: true,
    listGames: (username) => listAll<AnalysedGame>(GAMES, username),
    saveGame: (game) => put(GAMES, recordKey(game.username, game.id), game),
    listPuzzles: (username) => listAll<Puzzle>(PUZZLES, username),
    savePuzzle: (puzzle) => put(PUZZLES, recordKey(puzzle.username, puzzle.id), puzzle),
    clearUser: async (username) => {
      try {
        await settle(objectStore(GAMES, "readwrite").delete(userRange(username)));
        await settle(objectStore(PUZZLES, "readwrite").delete(userRange(username)));
      } catch (error) {
        console.warn("Effacement de la base impossible", error);
      }
    },
  };
}

/** Stockage en mémoire : la page reste utilisable le temps de l'onglet quand IndexedDB est refusé. */
export function memoryChessStore(): ChessStore {
  const games = new Map<string, AnalysedGame>();
  const puzzles = new Map<string, Puzzle>();
  const ofUser = <RecordType extends { username: string }>(records: Map<string, RecordType>, username: string) =>
    [...records.values()].filter((stored) => stored.username === username);
  const removeUser = (records: Map<string, { username: string }>, username: string) => {
    for (const [key, stored] of records) {
      if (stored.username === username) {
        records.delete(key);
      }
    }
  };
  return {
    isPersistent: false,
    listGames: async (username) => ofUser(games, username),
    saveGame: async (game) => {
      games.set(recordKey(game.username, game.id), game);
    },
    listPuzzles: async (username) => ofUser(puzzles, username),
    savePuzzle: async (puzzle) => {
      puzzles.set(recordKey(puzzle.username, puzzle.id), puzzle);
    },
    clearUser: async (username) => {
      removeUser(games, username);
      removeUser(puzzles, username);
    },
  };
}

/** Ouvre la base du navigateur, ou retombe sur la mémoire : la page ne dépend jamais du stockage. */
export async function openChessStore(): Promise<ChessStore> {
  try {
    return indexedDbStore(await openDatabase());
  } catch {
    return memoryChessStore();
  }
}
