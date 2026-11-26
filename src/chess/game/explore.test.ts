import { describe, expect, it } from "vitest";
import {
  createLine,
  describeEvaluation,
  fenAt,
  formatPawnsSigned,
  goTo,
  lastMoveOf,
  playMove,
  sanLineToUci,
  sideToMove,
  upcomingMove,
} from "./explore.ts";

/** Après 1. e4 e5 2. Dh5 Cc6 3. Fc4 Cf6 : les blancs matent par Dxf7#. */
const SCHOLAR = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("sanLineToUci", () => {
  it("traduit une suite et s'arrête au premier coup illisible", () => {
    expect(sanLineToUci(START, ["e4", "e5", "Nf3"])).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(sanLineToUci(START, ["e4", "Ke2", "Nf3"])).toEqual(["e2e4"]);
    expect(sanLineToUci("8/P7/8/8/8/8/k7/4K3 w - - 0 1", ["a8=Q"])).toEqual(["a7a8q"]);
  });
});

describe("navigation dans une suite", () => {
  const line = createLine(START, ["e2e4", "e7e5", "g1f3"]);

  it("part de la position de départ, sans dernier coup", () => {
    expect(fenAt(line)).toBe(START);
    expect(lastMoveOf(line)).toBeNull();
    expect(upcomingMove(line)).toBe("e2e4");
  });

  it("avance, recule et reste dans les bornes", () => {
    const second = goTo(line, 2);
    expect(lastMoveOf(second)).toBe("e7e5");
    expect(upcomingMove(second)).toBe("g1f3");
    expect(sideToMove(fenAt(second))).toBe("white");
    expect(goTo(line, 9).index).toBe(3);
    expect(goTo(line, -2).index).toBe(0);
    expect(upcomingMove(goTo(line, 3))).toBeNull();
    expect(createLine(START, ["e2e4"], 5).index).toBe(1);
  });

  it("revient à la position du problème quel que soit le chemin pris", () => {
    const explored = playMove(goTo(line, 1), "c7c5");
    expect(explored).not.toBeNull();
    expect(fenAt(goTo(explored ?? line, 0))).toBe(START);
  });

  it("s'arrête au premier coup impossible d'une suite enregistrée", () => {
    const broken = createLine(START, ["e2e4", "e2e4"], 2);
    expect(sideToMove(fenAt(broken))).toBe("black");
  });
});

describe("playMove", () => {
  it("ajoute un coup au bout de la suite", () => {
    const played = playMove(createLine(SCHOLAR), "h5f7");
    expect(played?.moves).toEqual(["h5f7"]);
    expect(played?.index).toBe(1);
    expect(sideToMove(fenAt(played ?? createLine(SCHOLAR)))).toBe("black");
  });

  it("coupe la suite quand on joue ailleurs qu'au bout", () => {
    const line = createLine(START, ["e2e4", "e7e5", "g1f3"], 1);
    expect(playMove(line, "c7c5")?.moves).toEqual(["e2e4", "c7c5"]);
  });

  it("refuse un coup illégal ou mal formé", () => {
    expect(playMove(createLine(START), "e2e5")).toBeNull();
    expect(playMove(createLine(START), "zz")).toBeNull();
  });
});

describe("describeEvaluation", () => {
  it("dit l'avantage du côté du joueur, quel que soit le camp au trait", () => {
    expect(describeEvaluation({ kind: "cp", value: 130 }, true).text).toBe("Évaluation : +1,3, avantage pour vous.");
    expect(describeEvaluation({ kind: "cp", value: 130 }, false).text).toBe(
      "Évaluation : −1,3, avantage pour l'adversaire.",
    );
    expect(describeEvaluation({ kind: "cp", value: 20 }, true).text).toBe("Évaluation : position égale.");
    expect(describeEvaluation({ kind: "cp", value: 0 }, true).winPercent).toBe(50);
  });

  it("annonce les mats et qui les donne", () => {
    expect(describeEvaluation({ kind: "mate", value: 2 }, true).text).toBe("Évaluation : mat en 2 pour vous.");
    expect(describeEvaluation({ kind: "mate", value: 3 }, false).text).toBe("Évaluation : mat en 3 pour l'adversaire.");
    expect(describeEvaluation({ kind: "mate", value: 0 }, false).text).toBe("Échec et mat.");
    expect(describeEvaluation({ kind: "mate", value: 1 }, true).winPercent).toBeGreaterThan(95);
  });
});

describe("formatPawnsSigned", () => {
  it("écrit les pions à la française, avec le signe", () => {
    expect(formatPawnsSigned(300)).toBe("+3,0");
    expect(formatPawnsSigned(-120)).toBe("−1,2");
    expect(formatPawnsSigned(0)).toBe("+0,0");
  });
});
