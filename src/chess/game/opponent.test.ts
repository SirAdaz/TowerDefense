import { describe, expect, it } from "vitest";
import { cp, mate } from "../../../tests/chessFixtures.ts";
import type { KeyValueStore } from "../../shared/storage.ts";
import { DEFAULT_LEVEL_ID, LEVEL_KEY, OPPONENT_LEVELS, levelById, loadLevel, pickReply, saveLevel } from "./opponent.ts";
import type { OpponentLevel } from "./opponent.ts";
import type { EngineLine } from "./types.ts";

const LINES: EngineLine[] = [
  { moveUci: "e2e4", score: cp(50), pvUci: ["e2e4"] },
  { moveUci: "d2d4", score: cp(30), pvUci: ["d2d4"] },
  { moveUci: "a2a3", score: cp(-100), pvUci: ["a2a3"] },
  { moveUci: "f2f3", score: mate(-2), pvUci: ["f2f3"] },
];

const EASY = levelById("easy");

function store(entries = new Map<string, string>()): KeyValueStore {
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

describe("pickReply", () => {
  it("joue le meilleur coup sous la part `bestShare`", () => {
    expect(pickReply(LINES, EASY, 0)).toBe("e2e4");
    expect(pickReply(LINES, EASY, EASY.bestShare - 0.01)).toBe("e2e4");
  });

  it("sinon tire un coup parmi ceux qui perdent au plus `maxLossCp`, jamais un mat concédé", () => {
    const picked = [0.55, 0.7, 0.85, 0.99].map((roll) => pickReply(LINES, EASY, roll));
    expect(new Set(picked)).toEqual(new Set(["e2e4", "d2d4", "a2a3"]));
    const strict: OpponentLevel = { ...EASY, maxLossCp: 30 };
    expect(pickReply(LINES, strict, 0.99)).toBe("d2d4");
  });

  it("au niveau le plus fort, toujours le meilleur ; rien sans variante", () => {
    expect(pickReply(LINES, levelById("strong"), 0.99)).toBe("e2e4");
    expect(pickReply([], EASY, 0.5)).toBeNull();
  });
});

describe("niveau de l'adversaire", () => {
  it("propose des niveaux du plus faible au plus fort, « Facile » par défaut", () => {
    expect(OPPONENT_LEVELS.map((level) => level.depth)).toEqual([...OPPONENT_LEVELS.map((level) => level.depth)].sort((a, b) => a - b));
    expect(DEFAULT_LEVEL_ID).toBe("easy");
    expect(levelById("inconnu").id).toBe("easy");
    expect(levelById(null).name).toBe("Facile");
  });

  it("garde le choix dans le navigateur", () => {
    const entries = new Map<string, string>();
    expect(loadLevel(store(entries)).id).toBe("easy");
    expect(saveLevel(store(entries), "medium")).toBe(true);
    expect(entries.get(LEVEL_KEY)).toBe("medium");
    expect(loadLevel(store(entries)).id).toBe("medium");
  });

  it("survit à un stockage refusé", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("refusé");
      },
      setItem: () => {
        throw new Error("refusé");
      },
      removeItem: () => undefined,
    };
    expect(loadLevel(broken).id).toBe("easy");
    expect(saveLevel(broken, "strong")).toBe(false);
  });
});
