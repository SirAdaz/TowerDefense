import { describe, expect, it } from "vitest";
import { arrowPoints, squareCenter } from "./arrow.ts";

describe("squareCenter", () => {
  it("place a1 en bas à gauche pour les blancs, en haut à droite pour les noirs", () => {
    expect(squareCenter("a1", "white")).toEqual({ x: 50, y: 750 });
    expect(squareCenter("a1", "black")).toEqual({ x: 750, y: 50 });
    expect(squareCenter("h8", "white")).toEqual({ x: 750, y: 50 });
    expect(squareCenter("e4", "white")).toEqual({ x: 450, y: 450 });
  });

  it("refuse une case inconnue", () => {
    expect(squareCenter("i1", "white")).toBeNull();
    expect(squareCenter("a9", "white")).toBeNull();
    expect(squareCenter("a0", "white")).toBeNull();
    expect(squareCenter("a", "white")).toBeNull();
  });
});

describe("arrowPoints", () => {
  it("trace une flèche verticale de e2 à e4, pointe au centre de e4", () => {
    const points = arrowPoints("e2e4", "white");
    expect(points).toHaveLength(7);
    expect(points?.[3]).toEqual({ x: 450, y: 450 });
    // Le trait part de e2 (y = 650), large de 22 unités ; la pointe commence 40 unités avant e4.
    expect(points?.[0]).toEqual({ x: 461, y: 650 });
    expect(points?.[6]).toEqual({ x: 439, y: 650 });
    expect(points?.[1]).toEqual({ x: 461, y: 490 });
    expect(points?.[2]).toEqual({ x: 478, y: 490 });
    expect(points?.[4]).toEqual({ x: 422, y: 490 });
  });

  it("suit l'orientation du plateau et ignore la pièce de promotion", () => {
    expect(arrowPoints("e7e8q", "black")?.[3]).toEqual({ x: 350, y: 750 });
    expect(arrowPoints("g1f3", "white")?.[3]).toEqual({ x: 550, y: 550 });
  });

  it("refuse un coup mal formé ou immobile", () => {
    expect(arrowPoints("e2", "white")).toBeNull();
    expect(arrowPoints("e2e2", "white")).toBeNull();
  });
});
