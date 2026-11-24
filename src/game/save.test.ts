import { describe, expect, it } from "vitest";
import { createGame, startNextWave, step } from "./engine.ts";
import {
  RECORD_KEY,
  SAVE_KEY,
  clearSnapshot,
  loadSnapshot,
  parseSnapshot,
  readRecord,
  saveSnapshot,
  updateRecord,
  type KeyValueStore,
} from "./save.ts";
import { buildTower, upgradeTower } from "./towers.ts";
import type { GameState } from "./types.ts";

function memoryStore(): KeyValueStore & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

const BROKEN_STORE: KeyValueStore = {
  getItem: () => {
    throw new Error("storage disabled");
  },
  setItem: () => {
    throw new Error("quota exceeded");
  },
  removeItem: () => {
    throw new Error("storage disabled");
  },
};

/** Partie en pleine vague 1 : deux tourelles, des ennemis sur le chemin. */
function midWaveGame(): GameState {
  const state = createGame();
  const tower = buildTower(state, { col: 3, row: 2 });
  buildTower(state, { col: 6, row: 3 });
  upgradeTower(state, tower?.id ?? 0, "damage");
  startNextWave(state);
  for (let i = 0; i < 200; i++) {
    step(state);
  }
  return state;
}

function withState(change: (state: Record<string, unknown>) => void): string {
  const state = JSON.parse(JSON.stringify(midWaveGame())) as Record<string, unknown>;
  change(state);
  return JSON.stringify({ version: 1, state, isFast: false });
}

function firstOf(state: Record<string, unknown>, list: "towers" | "enemies"): Record<string, unknown> {
  return (state[list] as Record<string, unknown>[])[0] ?? {};
}

describe("snapshot", () => {
  it("restores exactly the saved game, enemies on the path included", () => {
    const store = memoryStore();
    const state = midWaveGame();
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(saveSnapshot(store, { state, isFast: true })).toBe(true);
    const loaded = loadSnapshot(store);
    expect(loaded).toEqual({ state, isFast: true });
    expect(loaded?.state).not.toBe(state);
  });

  it("keeps playing the same game after a reload", () => {
    const store = memoryStore();
    const original = midWaveGame();
    saveSnapshot(store, { state: original, isFast: false });
    const reloaded = loadSnapshot(store)?.state ?? createGame();
    for (let i = 0; i < 1500; i++) {
      step(original);
      step(reloaded);
    }
    expect(reloaded).toEqual(original);
  });

  it("restores a fresh game and a countdown", () => {
    const store = memoryStore();
    saveSnapshot(store, { state: createGame(), isFast: false });
    expect(loadSnapshot(store)?.state).toEqual(createGame());
    const waiting: GameState = { ...createGame(), phase: "countdown", wave: 4, countdown: 6.5 };
    saveSnapshot(store, { state: waiting, isFast: false });
    expect(loadSnapshot(store)?.state).toEqual(waiting);
  });

  it("returns null when nothing is saved or the text is unreadable", () => {
    expect(loadSnapshot(memoryStore())).toBeNull();
    expect(parseSnapshot("{not json")).toBeNull();
    expect(parseSnapshot("null")).toBeNull();
    expect(parseSnapshot("[]")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ version: 2, state: createGame() }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ version: 1, state: "wave" }))).toBeNull();
  });

  it("accepts the untouched reference save used by the corruption cases", () => {
    expect(parseSnapshot(withState(() => undefined))).not.toBeNull();
  });

  it.each<[string, (state: Record<string, unknown>) => void]>([
    ["a lost game", (state) => (state.phase = "over")],
    ["an unknown phase", (state) => (state.phase = "bonus")],
    ["a negative wave", (state) => (state.wave = -1)],
    ["a decimal wave", (state) => (state.wave = 1.5)],
    ["no lives", (state) => (state.lives = 0)],
    ["too many lives", (state) => (state.lives = 99)],
    ["negative money", (state) => (state.money = -5)],
    ["money as text", (state) => (state.money = "150")],
    ["a missing id counter", (state) => delete state.nextId],
    ["a countdown above 10 s", (state) => (state.countdown = 60)],
    ["a non finite countdown", (state) => (state.countdown = null)],
    ["towers that are not a list", (state) => (state.towers = {})],
    ["enemies that are not a list", (state) => (state.enemies = "none")],
    ["a tower that is not an object", (state) => (state.towers = [3])],
    ["a tower on the path", (state) => Object.assign(firstOf(state, "towers"), { col: 0, row: 1 })],
    ["a tower outside the map", (state) => (firstOf(state, "towers").col = 16)],
    ["a tower without levels", (state) => delete firstOf(state, "towers").levels],
    ["a gauge above level 5", (state) => (firstOf(state, "towers").levels = { damage: 6, range: 1, rate: 1 })],
    ["a gauge at level 0", (state) => (firstOf(state, "towers").levels = { damage: 1, range: 0, rate: 1 })],
    ["a missing gauge", (state) => (firstOf(state, "towers").levels = { damage: 1, range: 1 })],
    ["a huge cooldown", (state) => (firstOf(state, "towers").cooldown = 50)],
    ["a tower without id", (state) => delete firstOf(state, "towers").id],
    ["two towers on the same cell", (state) => (state.towers = [firstOf(state, "towers"), firstOf(state, "towers")])],
    ["an enemy that is not an object", (state) => (state.enemies = [null])],
    ["an unknown enemy kind", (state) => (firstOf(state, "enemies").kind = "dragon")],
    ["an enemy without id", (state) => delete firstOf(state, "enemies").id],
    ["a dead enemy", (state) => (firstOf(state, "enemies").hp = 0)],
    ["an enemy with more health than its maximum", (state) => (firstOf(state, "enemies").hp = 9999)],
    ["an enemy without maximum health", (state) => delete firstOf(state, "enemies").maxHp],
    ["an enemy beyond the exit", (state) => (firstOf(state, "enemies").distance = 999)],
    ["a wrong spawn counter", (state) => (state.spawnedCount = -1)],
    ["more spawned enemies than the wave holds", (state) => (state.spawnedCount = 500)],
    ["more enemies on the map than spawned", (state) => (state.spawnedCount = 0)],
    ["a spawn timer as text", (state) => (state.spawnTimer = "soon")],
    ["a huge spawn timer", (state) => (state.spawnTimer = 500)],
    ["a wave in progress numbered 0", (state) => (state.wave = 0)],
    ["enemies before the first wave", (state) => Object.assign(state, { phase: "ready", wave: 0 })],
    ["a started wave while still waiting", (state) => Object.assign(state, { phase: "ready", enemies: [] })],
    ["enemies during the countdown", (state) => (state.phase = "countdown")],
    ["a countdown before any wave", (state) => Object.assign(state, { phase: "countdown", wave: 0, enemies: [] })],
  ])("rejects %s", (_label, change) => {
    expect(parseSnapshot(withState(change))).toBeNull();
  });

  it("is erased on demand, without touching the record", () => {
    const store = memoryStore();
    saveSnapshot(store, { state: createGame(), isFast: false });
    updateRecord(store, 7);
    expect(clearSnapshot(store)).toBe(true);
    expect(store.entries.has(SAVE_KEY)).toBe(false);
    expect(readRecord(store)).toBe(7);
  });

  it("survives a storage that throws", () => {
    expect(saveSnapshot(BROKEN_STORE, { state: createGame(), isFast: false })).toBe(false);
    expect(loadSnapshot(BROKEN_STORE)).toBeNull();
    expect(clearSnapshot(BROKEN_STORE)).toBe(false);
    expect(readRecord(BROKEN_STORE)).toBe(0);
    expect(updateRecord(BROKEN_STORE, 4)).toBe(4);
  });
});

describe("record", () => {
  it("starts at 0 and only goes up", () => {
    const store = memoryStore();
    expect(readRecord(store)).toBe(0);
    expect(updateRecord(store, 5)).toBe(5);
    expect(updateRecord(store, 3)).toBe(5);
    expect(readRecord(store)).toBe(5);
    expect(updateRecord(store, 12)).toBe(12);
    expect(store.entries.get(RECORD_KEY)).toBe("12");
  });

  it("ignores a stored value that is not a wave number", () => {
    const store = memoryStore();
    store.setItem(RECORD_KEY, "abc");
    expect(readRecord(store)).toBe(0);
    store.setItem(RECORD_KEY, "-3");
    expect(readRecord(store)).toBe(0);
  });
});
