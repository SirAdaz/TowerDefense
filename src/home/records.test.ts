import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "../shared/storage.ts";
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

  it("ignores a corrupted record", () => {
    expect(describeRecord("tower-defense", storeWith({ [RECORD_KEY]: "abc" }))).toBeNull();
  });
});
