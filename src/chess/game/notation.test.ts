import { describe, expect, it } from "vitest";
import { formatLine, frenchSan, squareAt, squareLabel } from "./notation.ts";

describe("French notation", () => {
  it("swaps the piece letters and nothing else", () => {
    expect(frenchSan("Nxf7+")).toBe("Cxf7+");
    expect(frenchSan("Qh5")).toBe("Dh5");
    expect(frenchSan("Rae1")).toBe("Tae1");
    expect(frenchSan("Bb5")).toBe("Fb5");
    expect(frenchSan("Kg1")).toBe("Rg1");
    expect(frenchSan("e8=Q#")).toBe("e8=D#");
    expect(frenchSan("O-O-O")).toBe("O-O-O");
    expect(frenchSan("exd5")).toBe("exd5");
  });
});

describe("numbered line", () => {
  it("numbers from the position when white starts", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(formatLine(fen, ["Qxf7#"])).toBe("4. Dxf7#");
    expect(formatLine(fen, ["Nc3", "g6", "Qf3"])).toBe("4. Cc3 g6 5. Df3");
  });

  it("starts with an ellipsis when black starts", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3";
    expect(formatLine(fen, ["g6", "Qf3", "Nf6"])).toBe("3… g6 4. Df3 Cf6");
  });

  it("copes with a position without move number", () => {
    expect(formatLine("8/8/8/8/8/8/8/8", ["Kg1"])).toBe("1. Rg1");
    expect(formatLine("", [])).toBe("");
  });
});

describe("square names for screen readers", () => {
  it("names the piece and its colour, agreeing in gender", () => {
    expect(squareLabel("e4", { type: "n", color: "w" })).toBe("e4, cavalier blanc");
    expect(squareLabel("d8", { type: "q", color: "b" })).toBe("d8, dame noire");
    expect(squareLabel("a1", { type: "r", color: "w" })).toBe("a1, tour blanche");
    expect(squareLabel("e8", { type: "k", color: "b" })).toBe("e8, roi noir");
    expect(squareLabel("c3", { type: "x", color: "w" })).toBe("c3, pièce blanc");
  });

  it("says when a square is empty", () => {
    expect(squareLabel("e5", null)).toBe("e5, vide");
  });
});

describe("board orientation", () => {
  it("puts a8 top left for white and h1 top left for black", () => {
    expect(squareAt(0, 0, "white")).toBe("a8");
    expect(squareAt(7, 7, "white")).toBe("h1");
    expect(squareAt(0, 0, "black")).toBe("h1");
    expect(squareAt(7, 0, "black")).toBe("h8");
  });

  it("falls back to the a-file outside the board", () => {
    expect(squareAt(0, 9, "white")).toBe("a8");
  });
});
