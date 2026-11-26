import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "../../shared/storage.ts";
import { loadIsSoundOn, moveSoundOf, saveIsSoundOn, SOUND_KEY } from "./sounds.ts";

function soundAfter(fen: string, san: string): string {
  const move = new Chess(fen).move(san);
  return moveSoundOf(move.san, move.flags);
}

function mapStore(): KeyValueStore & { entries: Map<string, string> } {
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

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("moveSoundOf", () => {
  it("joue un déplacement simple et une prise", () => {
    expect(soundAfter(START, "e4")).toBe("move");
    expect(soundAfter("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "exd5")).toBe("capture");
  });

  it("reconnaît la prise en passant, les deux roques et la promotion", () => {
    expect(soundAfter("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6")).toBe("capture");
    expect(soundAfter("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "O-O")).toBe("castle");
    expect(soundAfter("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "O-O-O")).toBe("castle");
    expect(soundAfter("8/P7/8/8/8/8/k7/4K3 w - - 0 1", "a8=N")).toBe("promote");
  });

  it("fait passer l'échec avant tout le reste, mat compris", () => {
    expect(soundAfter("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=Q+")).toBe("check");
    expect(soundAfter("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "Qxf7#")).toBe("check");
  });
});

describe("loadIsSoundOn / saveIsSoundOn", () => {
  it("garde le son actif par défaut, puis retient le choix", () => {
    const store = mapStore();
    expect(loadIsSoundOn(store)).toBe(true);
    expect(saveIsSoundOn(store, false)).toBe(true);
    expect(store.entries.get(SOUND_KEY)).toBe("off");
    expect(loadIsSoundOn(store)).toBe(false);
    saveIsSoundOn(store, true);
    expect(loadIsSoundOn(store)).toBe(true);
  });

  it("ne casse pas quand le stockage est refusé", () => {
    const refusing: KeyValueStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => undefined,
    };
    expect(loadIsSoundOn(refusing)).toBe(true);
    expect(saveIsSoundOn(refusing, false)).toBe(false);
  });
});
