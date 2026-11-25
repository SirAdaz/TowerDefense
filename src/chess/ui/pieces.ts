// Pièces dessinées pour cette page (grille de 45 × 45) : des silhouettes pleines, lisibles à 40 px.
// `shapes` est rempli de la couleur du camp, `details` n'est qu'un trait par-dessus.

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const BASE = "M9 39.5h27v-3.2c0-1.5-1.2-2.8-2.8-2.8H11.8C10.2 33.5 9 34.8 9 36.3z";

interface PieceDrawing {
  readonly shapes: readonly string[];
  readonly details: readonly string[];
}

const DRAWINGS: Readonly<Record<string, PieceDrawing>> = {
  p: {
    shapes: ["M22.5 7.5a5.6 5.6 0 1 1 0 11.2a5.6 5.6 0 1 1 0-11.2z", "M15.5 33.5c.3-6 3.2-8.5 4-13h6c.8 4.5 3.7 7 4 13z", BASE],
    details: ["M17 20.5h11"],
  },
  r: {
    shapes: ["M11.5 8h5v3.5h3.5V8h5v3.5h3.5V8h5v8.5l-3.5 3v10l3.5 4h-22l3.5-4v-10l-3.5-3z", BASE],
    details: ["M15 19.5h15", "M15 29.5h15"],
  },
  n: {
    shapes: [
      "M33.5 33.5V26c0-9-4.5-16-11.5-17l-1.5-4-3 4c-3.2 2-6.7 6.5-8.2 11.5l-.5 3.2 3.7 2.3 5-3.5c1.2 0 2 .8 2 2-1 3.5-7 5.5-7 9z",
      BASE,
    ],
    details: ["M16.5 14.5h1.5", "M26 13c3 3.5 4.3 8 4.3 13.5"],
  },
  b: {
    shapes: [
      "M22.5 3.5a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8z",
      "M22.5 8.5c-5.5 4.3-8.5 9-8.5 13.5 0 3.2 2 5.8 4.8 7l-2.3 4.5h12l-2.3-4.5c2.8-1.2 4.8-3.8 4.8-7 0-4.5-3-9.2-8.5-13.5z",
      BASE,
    ],
    details: ["M20 15l5 5.5", "M17.5 29h10"],
  },
  q: {
    shapes: [
      "M8.5 13l5.5 16.5-1 4h19l-1-4L36.5 13l-6.8 9-.7-12.5-4.7 11.7L22.5 8l-1.8 13.2L16 9.5 15.3 22z",
      "M8.5 10.5a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z",
      "M16 7a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z",
      "M22.5 5.5a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z",
      "M29 7a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z",
      "M36.5 10.5a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z",
      BASE,
    ],
    details: ["M14 29.5h17"],
  },
  k: {
    shapes: [
      "M21 2.5h3v3h3v3h-3v4h-3v-4h-3v-3h3z",
      "M22.5 14.5c-6.5-4.5-13.5-.5-13.5 5.7 0 4.8 3.8 7.8 5.5 10.8l-1 2.5h18l-1-2.5c1.7-3 5.5-6 5.5-10.8 0-6.2-7-10.2-13.5-5.7z",
      BASE,
    ],
    details: ["M22.5 14.5v16", "M14.5 30.5h16"],
  },
};

function appendPath(svg: SVGSVGElement, pathData: string, className: string): void {
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", pathData);
  path.setAttribute("class", className);
  svg.append(path);
}

/** Dessin d'une pièce, décoratif : le nom de la pièce est porté par le libellé de sa case. */
export function createPiece(type: string, color: "w" | "b"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 45 45");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `piece ${color === "w" ? "piece-white" : "piece-black"}`);
  const drawing = DRAWINGS[type];
  drawing?.shapes.forEach((pathData) => {
    appendPath(svg, pathData, "piece-shape");
  });
  drawing?.details.forEach((pathData) => {
    appendPath(svg, pathData, "piece-detail");
  });
  return svg;
}
