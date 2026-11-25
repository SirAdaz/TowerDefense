import { describe, expect, it } from "vitest";
import { SOLVED_COUNT_KEY } from "../chess/game/summary.ts";
import type { KeyValueStore } from "../shared/storage.ts";
import { PROFILE_KEY } from "../survival/game/profile.ts";
import { RECORD_KEY } from "../tower-defense/game/save.ts";
import { GAME_RECORDS } from "./records.ts";

function storeWith(entries: Record<string, string>): KeyValueStore {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function describeRecord(gameId: string, store: KeyValueStore): string | null {
  const gameRecord = GAME_RECORDS.find((candidate) => candidate.gameId === gameId);
  if (gameRecord === undefined) {
    throw new Error(`Unknown game ${gameId}`);
  }
  return gameRecord.describe(store);
}

describe("records shown on the home page", () => {
  it("shows nothing for a game never played", () => {
    expect(describeRecord("tower-defense", storeWith({}))).toBeNull();
  });

  it("reads the tower defense best wave from the key the game writes", () => {
    expect(describeRecord("tower-defense", storeWith({ [RECORD_KEY]: "17" }))).toBe("Record : vague 17");
  });

  it("reads the survival best score and time from the profile the game writes", () => {
    expect(describeRecord("nuit-blanche", storeWith({}))).toBeNull();
    const profile = JSON.stringify({ bestScore: 12340, bestSeconds: 252, hasWon: false, coins: 3, unlocked: [] });
    const line = describeRecord("nuit-blanche", storeWith({ [PROFILE_KEY]: profile }));
    expect(line?.replace(/\s/g, " ")).toBe("Record : 12 340 points · tenu 4:12");
  });

  it("reads the number of chess puzzles solved from the key the page writes", () => {
    expect(describeRecord("echecs", storeWith({}))).toBeNull();
    expect(describeRecord("echecs", storeWith({ [SOLVED_COUNT_KEY]: "7" }))).toBe("7 problèmes réussis");
  });

  it("ignores a corrupted record", () => {
    expect(describeRecord("nuit-blanche", storeWith({ [PROFILE_KEY]: "{oops" }))).toBeNull();
    expect(describeRecord("tower-defense", storeWith({ [RECORD_KEY]: "abc" }))).toBeNull();
  });
});
