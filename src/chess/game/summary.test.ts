import { describe, expect, it } from "vitest";
import { TEST_USER, puzzle } from "../../../tests/chessFixtures.ts";
import type { KeyValueStore } from "../../shared/storage.ts";
import {
  SOLVED_COUNT_KEY,
  USERNAME_KEY,
  countSolved,
  describeChessRecord,
  forgetUsername,
  loadUsername,
  saveSolvedCount,
  saveUsername,
} from "./summary.ts";

function memoryStore(): KeyValueStore {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

describe("username kept in the browser", () => {
  it("is empty at first, then read back once saved", () => {
    const store = memoryStore();
    expect(loadUsername(store)).toBeNull();
    expect(saveUsername(store, TEST_USER)).toBe(true);
    expect(loadUsername(store)).toBe(TEST_USER);
  });

  it("ignores a stored value that is not a username", () => {
    const store = memoryStore();
    store.setItem(USERNAME_KEY, "<script>");
    expect(loadUsername(store)).toBeNull();
  });

  it("forgets the username and the home page record together", () => {
    const store = memoryStore();
    saveUsername(store, TEST_USER);
    saveSolvedCount(store, 4);
    forgetUsername(store);
    expect(loadUsername(store)).toBeNull();
    expect(store.getItem(SOLVED_COUNT_KEY)).toBeNull();
  });
});

describe("a browser that refuses storage", () => {
  const refusingStore: KeyValueStore = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };

  it("never breaks the page", () => {
    expect(loadUsername(refusingStore)).toBeNull();
    expect(saveUsername(refusingStore, TEST_USER)).toBe(false);
    expect(() => {
      saveSolvedCount(refusingStore, 3);
      forgetUsername(refusingStore);
    }).not.toThrow();
  });
});

describe("record shown on the home page", () => {
  it("counts puzzles solved at least once", () => {
    const solved = puzzle({ review: { step: 1, dueAt: 0, attempts: 2, successes: 1 } });
    const failed = puzzle({ review: { step: 0, dueAt: 0, attempts: 1, successes: 0 } });
    expect(countSolved([solved, failed, puzzle()])).toBe(1);
  });

  it("stays hidden until a puzzle is solved, then agrees in number", () => {
    const store = memoryStore();
    expect(describeChessRecord(store)).toBeNull();
    saveSolvedCount(store, 0);
    expect(describeChessRecord(store)).toBeNull();
    saveSolvedCount(store, 1);
    expect(describeChessRecord(store)).toBe("1 problème réussi");
    saveSolvedCount(store, 12);
    expect(describeChessRecord(store)).toBe("12 problèmes réussis");
  });

  it("ignores a corrupted count", () => {
    const store = memoryStore();
    store.setItem(SOLVED_COUNT_KEY, "many");
    expect(describeChessRecord(store)).toBeNull();
  });
});
