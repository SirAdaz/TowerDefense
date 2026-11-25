import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "../../shared/storage.ts";
import { describeRecord, formatCoins, formatTime } from "../ui/format.ts";
import { describeChoice, describeUpgrade } from "../ui/texts.ts";
import { UNLOCKS } from "./balance.ts";
import {
  applyRun,
  buyUnlock,
  emptyProfile,
  loadProfile,
  parseProfile,
  PROFILE_KEY,
  saveProfile,
  unlockCost,
  type Profile,
} from "./profile.ts";
import { createGame } from "./state.ts";
import { summarizeRun } from "./summary.ts";

function memoryStore(entries: Record<string, string> = {}): KeyValueStore {
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

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
  removeItem: () => undefined,
};

const played: Profile = { bestScore: 5000, bestSeconds: 200, hasWon: false, coins: 60, unlocked: ["regen"] };

describe("the stored profile", () => {
  it("comes back as it was saved", () => {
    const store = memoryStore();
    expect(saveProfile(store, played)).toBe(true);
    expect(loadProfile(store)).toEqual(played);
  });

  it("starts empty when nothing is stored or storage is denied", () => {
    expect(loadProfile(memoryStore())).toEqual(emptyProfile());
    expect(loadProfile(brokenStore)).toEqual(emptyProfile());
    expect(saveProfile(brokenStore, played)).toBe(false);
  });

  it("ignores anything invalid, field by field", () => {
    expect(parseProfile("not json")).toEqual(emptyProfile());
    expect(parseProfile("null")).toEqual(emptyProfile());
    expect(parseProfile('"text"')).toEqual(emptyProfile());
    const tampered = { bestScore: -5, bestSeconds: 1.5, hasWon: "yes", coins: 40, unlocked: ["storm", "godmode", 3] };
    expect(parseProfile(JSON.stringify(tampered))).toEqual({ ...emptyProfile(), coins: 40, unlocked: ["storm"] });
    expect(parseProfile(JSON.stringify({ unlocked: "storm" })).unlocked).toEqual([]);
    expect(loadProfile(memoryStore({ [PROFILE_KEY]: JSON.stringify(played) }))).toEqual(played);
  });
});

describe("the end of a run", () => {
  it("adds coins, keeps the best score and the longest time", () => {
    const state = createGame(1);
    state.time = 250;
    state.killPoints = 4000;
    state.kills = 300;
    const summary = summarizeRun(state, played);
    expect(summary).toMatchObject({ score: 6500, seconds: 250, hasWon: false, kills: 300, level: 1, coins: 25, isNewRecord: true });
    expect(applyRun(played, summary)).toEqual({ ...played, bestScore: 6500, bestSeconds: 250, coins: 85 });
  });

  it("keeps the record after a worse run, and remembers a victory", () => {
    const state = createGame(1);
    state.time = 30;
    const summary = summarizeRun(state, played);
    expect(summary.isNewRecord).toBe(false);
    expect(applyRun(played, summary)).toMatchObject({ bestScore: 5000, bestSeconds: 200, coins: 63 });
    expect(applyRun(played, { ...summary, hasWon: true }).hasWon).toBe(true);
  });
});

describe("unlocks", () => {
  it("costs coins once and adds the card to the draw", () => {
    const afterPurchase = buyUnlock(played, "storm");
    expect(afterPurchase).toEqual({ ...played, coins: 10, unlocked: ["regen", "storm"] });
    expect(unlockCost(played, "storm")).toBe(50);
    expect(unlockCost(played, "regen")).toBeNull();
    expect(unlockCost(played, "spark")).toBeNull();
  });

  it("refuses what is already owned or too expensive", () => {
    expect(buyUnlock(played, "regen")).toBeNull();
    expect(buyUnlock(played, "wisdom")).toBeNull();
    expect(buyUnlock(played, "spark")).toBeNull();
  });

  it("can all be bought with the coins of a few good nights", () => {
    const total = UNLOCKS.reduce((sum, unlock) => sum + unlock.cost, 0);
    expect(total).toBeLessThanOrEqual(400);
    expect(UNLOCKS.map((unlock) => unlock.cost)).toEqual([...UNLOCKS.map((unlock) => unlock.cost)].sort((a, b) => a - b));
  });
});

describe("texts shown to the player", () => {
  it("formats durations and coins", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(252.9)).toBe("4:12");
    expect(formatTime(600)).toBe("10:00");
    expect(formatCoins(1)).toBe("1 pièce");
    expect(formatCoins(30)).toBe("30 pièces");
  });

  it("describes the record, or nothing before the first run", () => {
    expect(describeRecord(emptyProfile())).toBeNull();
    expect(describeRecord({ ...played, bestSeconds: 252 })?.replace(/\s/g, " ")).toBe("Record : 5 000 points · tenu 4:12");
    expect(describeRecord({ ...played, hasWon: true })).toContain("aube atteinte");
  });

  it("describes upgrade cards", () => {
    expect(describeChoice({ kind: "weapon", id: "halo", level: 1 })).toMatchObject({ tag: "Arme · nouveau", name: "Halo" });
    expect(describeChoice({ kind: "weapon", id: "spark", level: 3 }).text).toBe("Deux traits à chaque tir.");
    expect(describeChoice({ kind: "passive", id: "vigor", level: 2 }).tag).toBe("Passif · niveau 2");
    expect(describeChoice({ kind: "heal", id: "heal", level: 0 }).name).toBe("Second souffle");
    expect(describeUpgrade("storm")).toMatchObject({ tag: "Arme", name: "Foudre" });
    expect(describeUpgrade("regen")).toMatchObject({ tag: "Passif", name: "Souffle" });
  });
});
