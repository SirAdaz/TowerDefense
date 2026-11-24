import { describe, expect, it } from "vitest";
import { createGame } from "./game.ts";
import {
  type KeyValueStore,
  RECORD_KEY,
  SAVE_KEY,
  clearSave,
  parseSave,
  readRecord,
  readSave,
  toSaveData,
  updateRecord,
  writeSave,
} from "./save.ts";
import { buildTower, upgradeTower } from "./towers.ts";

function memoryStore(): KeyValueStore & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function brokenStore(): KeyValueStore {
  const fail = (): never => {
    throw new Error("storage disabled");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function savedGame() {
  const state = createGame();
  state.money = 500;
  const tower = buildTower(state, { col: 0, row: 0 });
  if (!tower) throw new Error("tower expected");
  upgradeTower(state, tower.id, "rate");
  tower.kills = 12;
  state.wave = 7;
  state.lives = 14;
  return state;
}

describe("save", () => {
  it("restores the wave, lives, money and towers with their gauges", () => {
    const store = memoryStore();
    writeSave(store, savedGame());
    const restored = readSave(store);
    expect(restored).toMatchObject({ phase: "intermission", wave: 7, lives: 14, money: 425, intermissionLeft: 10 });
    expect(restored?.towers).toHaveLength(1);
    expect(restored?.towers[0]).toMatchObject({ col: 0, row: 0, levels: { damage: 1, range: 1, rate: 2 }, spent: 75, kills: 12 });
    expect(restored?.enemies).toEqual([]);
  });

  it("keeps waiting for the first click when saved before wave 1", () => {
    const store = memoryStore();
    writeSave(store, createGame());
    expect(readSave(store)?.intermissionLeft).toBeNull();
  });

  it("only stores the between-waves data, never the enemies", () => {
    const saved = toSaveData(savedGame());
    expect(Object.keys(saved).sort()).toEqual(["lives", "money", "towers", "version", "wave"]);
  });

  it("starts fresh from a missing, broken or tampered save", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("{not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSaveData(savedGame()), version: 2 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSaveData(savedGame()), lives: 0 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSaveData(savedGame()), money: -5 }))).toBeNull();
    const badTower = { col: 0, row: 0, levels: { damage: 6, range: 1, rate: 1 }, spent: 50, kills: 0 };
    expect(parseSave(JSON.stringify({ ...toSaveData(savedGame()), towers: [badTower] }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSaveData(savedGame()), towers: [null] }))).toBeNull();
    expect(parseSave("null")).toBeNull();
  });

  it("drops towers saved on the path or twice on the same cell", () => {
    const saved = toSaveData(savedGame());
    const onPath = { ...saved.towers[0]!, col: 0, row: 1 };
    const restored = parseSave(JSON.stringify({ ...saved, towers: [...saved.towers, saved.towers[0], onPath] }));
    expect(restored?.towers).toHaveLength(1);
  });

  it("erases the save when the game is lost", () => {
    const store = memoryStore();
    const state = savedGame();
    writeSave(store, state);
    state.phase = "gameOver";
    writeSave(store, state);
    expect(store.items.has(SAVE_KEY)).toBe(false);
  });

  it("survives a storage that throws", () => {
    const store = brokenStore();
    expect(writeSave(store, savedGame())).toBe(false);
    expect(readSave(store)).toBeNull();
    expect(clearSave(store)).toBe(false);
    expect(readRecord(store)).toBe(0);
  });

  it("clears the save on demand", () => {
    const store = memoryStore();
    writeSave(store, savedGame());
    expect(clearSave(store)).toBe(true);
    expect(readSave(store)).toBeNull();
  });
});

describe("record", () => {
  it("keeps the best wave only", () => {
    const store = memoryStore();
    expect(readRecord(store)).toBe(0);
    expect(updateRecord(store, 12)).toBe(12);
    expect(updateRecord(store, 8)).toBe(12);
    expect(store.items.get(RECORD_KEY)).toBe("12");
  });

  it("ignores a broken record and still reports a new best when storage refuses it", () => {
    const store = memoryStore();
    store.items.set(RECORD_KEY, "abc");
    expect(readRecord(store)).toBe(0);
    const readOnly = { ...memoryStore(), setItem: () => { throw new Error("quota"); } };
    expect(updateRecord(readOnly, 5)).toBe(5);
  });
});
