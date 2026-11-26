import { describe, expect, it } from "vitest";
import { puzzle } from "../../../tests/chessFixtures.ts";
import { THEME_NAMES, detectTheme, selectThemeSession, themeStats } from "./themes.ts";
import type { TacticTheme } from "./themes.ts";
import type { Puzzle } from "./types.ts";

/** Positions inventées : le meilleur coup et la suite du moteur, en notation anglaise. */
const CASES: readonly (readonly [TacticTheme, string, readonly string[]])[] = [
  ["mateIn1", "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", ["Qxf7#"]],
  ["mateIn2", "2r4k/6pp/8/8/8/8/3R2PP/3R2K1 w - - 0 1", ["Rd8+", "Rxd8", "Rxd8#"]],
  ["mateIn3", "7k/8/8/8/8/8/8/RR4K1 w - - 0 1", ["Ra7", "Kg8", "Kg2", "Kh8", "Rb8#"]],
  ["hangingPiece", "4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1", ["Qxd5"]],
  ["fork", "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", ["Nc7+", "Kd7", "Nxa8"]],
  ["fork", "8/1k6/8/1N3r2/7b/8/6P1/6K1 w - - 0 1", ["Nd6+", "Kc6", "g3", "Rf3", "gxh4"]],
  ["hangingPiece", "8/4bk2/6q1/4p3/1p2Qp1B/1P3P2/7K/8 w - - 0 1", ["Qxg6+", "Kxg6", "Bxe7"]],
  ["endgame", "8/8/8/4k3/8/8/4K3/R7 w - - 0 1", ["Ra5+", "Kd4", "Kd2"]],
  ["discoveredAttack", "4k3/8/8/8/4q3/8/4N3/4R1K1 w - - 0 1", ["Ng3", "Kd8", "Rxe4"]],
  ["pin", "4k3/8/2n5/1B6/3P4/8/8/4K3 w - - 0 1", ["d5", "Kf7", "dxc6"]],
  ["skewer", "4k2q/8/8/8/8/8/8/R3K3 w - - 0 1", ["Ra8+", "Kd7", "Rxh8"]],
];

describe("detectTheme", () => {
  it.each(CASES)("reconnaît %s", (theme, fen, solutionLine) => {
    expect(detectTheme({ fen, solutionLine })).toBe(theme);
  });

  it("dit « autre » quand la suite ne gagne pas de matériel (défense, coup calme)", () => {
    const defence = "r1bqkbnr/2pp1pp1/p1n4p/4p2Q/2B1P3/2NP4/PPP2PPP/R1B1K1NR b KQkq - 1 5";
    expect(detectTheme({ fen: defence, solutionLine: ["g6", "Qf3", "Nf6"] })).toBe("other");
  });

  it("ne donne pas de motif à un gain qui n'en suit aucun (promotion) : finale si peu de pièces", () => {
    expect(detectTheme({ fen: "8/P7/8/7k/8/8/8/2K5 w - - 0 1", solutionLine: ["a8=Q"] })).toBe("endgame");
  });

  it("ne voit pas de fourchette quand une seule pièce de valeur est attaquée : la pièce prise ensuite est en prise", () => {
    expect(detectTheme({ fen: "r6k/8/8/1N6/8/8/8/4K3 w - - 0 1", solutionLine: ["Nc7", "Kg8", "Nxa8"] })).toBe("hangingPiece");
  });

  it("lit le coup de la partie quand la bonne réponse est une défense", () => {
    const queenDrop = "rnbqk2r/ppp2ppp/3bp3/3p4/3P1B2/4PQ2/PPP2PPP/RN2KBNR w KQkq - 2 6";
    expect(detectTheme({ fen: queenDrop, solutionLine: ["Bxd6", "Qxd6"], playedSan: "Qe4" })).toBe("hungPiece");
    const knightAttacked = "rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
    expect(detectTheme({ fen: knightAttacked, solutionLine: ["Nd5"], playedSan: "d6" })).toBe("ignoredThreat");
    expect(detectTheme({ fen: knightAttacked, solutionLine: ["Nd5"], kind: "allowedMate" })).toBe("allowedMate");
    expect(detectTheme({ fen: knightAttacked, solutionLine: ["Nd5"], playedSan: "Ng8" })).toBe("other");
  });

  it("tient pour « en prise » une pièce prise par moins fort qu'elle, même défendue", () => {
    expect(detectTheme({ fen: "4k3/3r4/8/2N5/8/8/8/4K3 w - - 0 1", solutionLine: ["Nxd7", "Kxd7"] })).toBe("hangingPiece");
  });

  it("dit « autre » sans suite lisible", () => {
    expect(detectTheme({ fen: puzzle().fen, solutionLine: [] })).toBe("other");
    expect(detectTheme({ fen: puzzle().fen, solutionLine: ["Zz9"] })).toBe("other");
  });

  it("a un nom en français pour chaque thème", () => {
    expect(THEME_NAMES.fork).toBe("Fourchette");
    expect(Object.keys(THEME_NAMES)).toHaveLength(13);
  });
});

const NOW = 1_800_000_000_000;

function themed(id: string, theme: TacticTheme, review: Partial<Puzzle["review"]> = {}, gameEndTime = 1_700_000_000): Puzzle {
  return puzzle({ id, solutionLine: [theme], gameEndTime, review: { step: -1, dueAt: 0, attempts: 0, successes: 0, ...review } });
}

const themeOf = (target: Puzzle) => target.solutionLine[0] as TacticTheme;

describe("themeStats", () => {
  it("classe les thèmes du plus raté au moins raté, avec le taux de réussite, « autre » à la fin", () => {
    const stats = themeStats(
      [
        themed("a", "other"),
        themed("b", "other"),
        themed("c", "other"),
        themed("d", "fork", { attempts: 2, successes: 1 }),
        themed("e", "fork", { attempts: 2, successes: 0 }),
        themed("f", "pin", { attempts: 1, successes: 1 }),
        themed("g", "skewer"),
      ],
      themeOf,
    );
    expect(stats.map((stat) => stat.theme)).toEqual(["fork", "pin", "skewer", "other"]);
    expect(stats[0]).toEqual({ theme: "fork", count: 2, attempts: 4, successes: 1, successRate: 0.25 });
    expect(stats[2]?.successRate).toBeNull();
  });

  it("à nombre égal, met le moins bien réussi d'abord", () => {
    const stats = themeStats([themed("a", "pin", { attempts: 1, successes: 1 }), themed("b", "fork", { attempts: 1, successes: 0 })], themeOf);
    expect(stats.map((stat) => stat.theme)).toEqual(["fork", "pin"]);
  });
});

describe("selectThemeSession", () => {
  const dueFork = themed("due-fork", "fork", { step: 0, dueAt: NOW - 1000, attempts: 1 });
  const laterFork = themed("later-fork", "fork", { step: 2, dueAt: NOW + 5000, attempts: 3, successes: 2 });
  const soonFork = themed("soon-fork", "fork", { step: 1, dueAt: NOW + 1000, attempts: 2, successes: 1 });
  const newPin = themed("new-pin", "pin");

  it("sans thème, garde la séance habituelle", () => {
    expect(selectThemeSession([dueFork, laterFork, newPin], NOW, null, themeOf).map((item) => item.id)).toEqual(["due-fork", "new-pin"]);
  });

  it("sur un thème, ses problèmes dus puis les autres, du plus proche au plus lointain", () => {
    expect(selectThemeSession([laterFork, newPin, soonFork, dueFork], NOW, "fork", themeOf).map((item) => item.id)).toEqual([
      "due-fork",
      "soon-fork",
      "later-fork",
    ]);
  });
});
