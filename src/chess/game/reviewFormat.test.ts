import { describe, expect, it } from "vitest";
import { formatSeconds, moveNumberLabel, sideName } from "./reviewFormat.ts";

describe("reviewFormat", () => {
  it("numérote les coups des deux camps en notation française", () => {
    expect(moveNumberLabel({ ply: 0, san: "e4" })).toBe("1. e4");
    expect(moveNumberLabel({ ply: 5, san: "Nf6" })).toBe("3… Cf6");
    expect(moveNumberLabel({ ply: 22, san: "Qxf7#" })).toBe("12. Dxf7#");
  });

  it("dit une durée courte à la française", () => {
    expect(formatSeconds(0.84)).toBe("0,8 s");
    expect(formatSeconds(12.4)).toBe("12 s");
    expect(formatSeconds(65)).toBe("1 min 05");
  });

  it("nomme les camps", () => {
    expect(sideName("white")).toBe("blancs");
    expect(sideName("black")).toBe("noirs");
  });
});
