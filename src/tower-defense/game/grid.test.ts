import { describe, expect, it } from "vitest";
import { COLS, PATH, PATH_LENGTH, ROWS, cellAt, cellKey, isInsideGrid, isOnPath, pathCell, pointAlongPath } from "./grid.ts";

describe("grid", () => {
  it("has a 16 x 10 map and a 36-cell path inside it", () => {
    expect(COLS).toBe(16);
    expect(ROWS).toBe(10);
    expect(PATH).toHaveLength(36);
    expect(PATH.every(isInsideGrid)).toBe(true);
  });

  it("is a continuous path: each step moves by exactly one cell", () => {
    for (let i = 1; i < PATH.length; i++) {
      const previous = pathCell(i - 1);
      const current = pathCell(i);
      expect(Math.abs(current.col - previous.col) + Math.abs(current.row - previous.row)).toBe(1);
    }
  });

  it("never visits the same cell twice", () => {
    expect(new Set(PATH.map(cellKey)).size).toBe(PATH.length);
  });

  it("tells path cells from free cells", () => {
    expect(isOnPath({ col: 0, row: 1 })).toBe(true);
    expect(isOnPath({ col: 0, row: 0 })).toBe(false);
    expect(isInsideGrid({ col: 16, row: 0 })).toBe(false);
    expect(isInsideGrid({ col: 0, row: -1 })).toBe(false);
  });

  it("walks along the path from the first to the last cell center", () => {
    expect(pointAlongPath(0)).toEqual({ x: 0.5, y: 1.5 });
    expect(pointAlongPath(0.5)).toEqual({ x: 1, y: 1.5 });
    expect(pointAlongPath(PATH_LENGTH)).toEqual({ x: 15.5, y: 7.5 });
    expect(pointAlongPath(-3)).toEqual({ x: 0.5, y: 1.5 });
    expect(pointAlongPath(PATH_LENGTH + 4)).toEqual({ x: 15.5, y: 7.5 });
  });

  it("finds the cell under a point", () => {
    expect(cellAt({ x: 3.9, y: 0.1 })).toEqual({ col: 3, row: 0 });
    expect(pathCell(99)).toEqual({ col: 15, row: 7 });
  });
});
