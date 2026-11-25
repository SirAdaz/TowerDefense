import { describe, expect, it } from "vitest";
import { collectLines, isBestMoveLine, parseInfoLine, parseUciMove } from "./uci.ts";

const INFO = "info depth 14 seldepth 20 multipv 2 score cp -35 nodes 9000 nps 600000 time 15 pv e7e5 g1f3 b8c6";

describe("info lines", () => {
  it("reads rank, depth, score and line", () => {
    expect(parseInfoLine(INFO)).toEqual({
      multiPv: 2,
      depth: 14,
      score: { kind: "cp", value: -35 },
      isExact: true,
      moveUci: "e7e5",
      pvUci: ["e7e5", "g1f3", "b8c6"],
    });
  });

  it("reads a mate score and defaults to the first rank", () => {
    const parsed = parseInfoLine("info depth 9 score mate -3 pv h2h3");
    expect(parsed?.score).toEqual({ kind: "mate", value: -3 });
    expect(parsed?.multiPv).toBe(1);
  });

  it("marks bounds as inexact", () => {
    expect(parseInfoLine("info depth 16 score cp 20 lowerbound pv e2e4")?.isExact).toBe(false);
    expect(parseInfoLine("info depth 16 score cp 20 upperbound pv e2e4")?.isExact).toBe(false);
  });

  it("ignores lines without a usable evaluation", () => {
    expect(parseInfoLine("info depth 12 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfoLine("info string NNUE evaluation enabled")).toBeNull();
    expect(parseInfoLine("info depth 12 score cp abc pv e2e4")).toBeNull();
    expect(parseInfoLine("info depth 12 score win 3 pv e2e4")).toBeNull();
    expect(parseInfoLine("info depth x score cp 3 pv e2e4")).toBeNull();
    expect(parseInfoLine("info depth 12 score cp 3 pv")).toBeNull();
    expect(parseInfoLine("bestmove e2e4 ponder e7e5")).toBeNull();
  });

  it("spots the end of a search", () => {
    expect(isBestMoveLine("bestmove e2e4 ponder e7e5")).toBe(true);
    expect(isBestMoveLine(INFO)).toBe(false);
  });
});

describe("collecting the final lines", () => {
  const parse = (line: string) => {
    const parsed = parseInfoLine(line);
    if (parsed === null) {
      throw new Error(`Unparsed line: ${line}`);
    }
    return parsed;
  };

  it("keeps the deepest line of each rank, best rank first", () => {
    const lines = collectLines([
      parse("info depth 10 multipv 2 score cp 10 pv d2d4"),
      parse("info depth 10 multipv 1 score cp 30 pv e2e4"),
      parse("info depth 11 multipv 1 score cp 25 pv g1f3 d7d5"),
    ]);
    expect(lines).toEqual([
      { moveUci: "g1f3", score: { kind: "cp", value: 25 }, pvUci: ["g1f3", "d7d5"] },
      { moveUci: "d2d4", score: { kind: "cp", value: 10 }, pvUci: ["d2d4"] },
    ]);
  });

  it("prefers an exact evaluation to a deeper bound", () => {
    const lines = collectLines([
      parse("info depth 15 score cp 40 pv e2e4"),
      parse("info depth 16 score cp 90 lowerbound pv d2d4"),
    ]);
    expect(lines[0]?.moveUci).toBe("e2e4");
  });

  it("falls back to a bound when nothing else exists, then replaces it", () => {
    const bound = parse("info depth 16 score cp 90 lowerbound pv d2d4");
    expect(collectLines([bound])[0]?.moveUci).toBe("d2d4");
    expect(collectLines([bound, parse("info depth 12 score cp 40 pv e2e4")])[0]?.moveUci).toBe("e2e4");
  });

  it("returns nothing for a search without lines", () => {
    expect(collectLines([])).toEqual([]);
  });
});

describe("UCI moves", () => {
  it("splits squares and promotion", () => {
    expect(parseUciMove("e2e4")).toEqual({ from: "e2", to: "e4" });
    expect(parseUciMove("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
  });

  it("rejects malformed moves", () => {
    expect(parseUciMove("(none)")).toBeNull();
    expect(parseUciMove("e2e9")).toBeNull();
  });
});
