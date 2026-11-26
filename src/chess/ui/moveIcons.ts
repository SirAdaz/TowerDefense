import type { MoveClass } from "../game/moveClass.ts";

/**
 * Icônes maison des avis sur les coups : chaque avis a sa forme, son signe et sa couleur, pour se
 * lire sans la couleur. Les signes sont ceux de l'annotation des échecs (!!, !, ?!, ?, ??).
 */
interface IconDrawing {
  readonly label: string;
  /** Contour de la forme, dans un carré de 20 × 20. */
  readonly shape: string;
  /** Signe tracé par-dessus : texte court, ou chemin quand `isPath`. */
  readonly sign: string;
  readonly isPath: boolean;
}

const CIRCLE = "M10 1a9 9 0 1 1 0 18a9 9 0 1 1 0-18z";
const SQUARE = "M3 1h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z";

const ICONS: Readonly<Record<MoveClass, IconDrawing>> = {
  brilliant: { label: "brillant", shape: "M10 0l10 10-10 10L0 10z", sign: "!!", isPath: false },
  best: {
    label: "meilleur coup",
    shape: "M10 0.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L10 15.4l-5.9 3.1 1.2-6.5L.5 7.4l6.6-.9z",
    sign: "",
    isPath: false,
  },
  excellent: { label: "excellent", shape: CIRCLE, sign: "!", isPath: false },
  good: { label: "bon coup", shape: CIRCLE, sign: "M5.5 10.5l3 3 6-7", isPath: true },
  inaccuracy: { label: "imprécision", shape: SQUARE, sign: "?!", isPath: false },
  mistake: { label: "erreur", shape: SQUARE, sign: "?", isPath: false },
  miss: { label: "occasion manquée", shape: "M6 1h8l5 9-5 9H6l-5-9z", sign: "M6.5 6.5l7 7M13.5 6.5l-7 7", isPath: true },
  blunder: { label: "gaffe", shape: "M10 0.5l9.5 18H.5z", sign: "??", isPath: false },
};

const SVG_NS = "http://www.w3.org/2000/svg";

export function moveClassLabel(moveClass: MoveClass): string {
  return ICONS[moveClass].label;
}

function svgElement(tagName: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const created = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    created.setAttribute(name, value);
  });
  return created;
}

/** Dessin de l'icône dans un groupe SVG (20 × 20), pour la liste comme pour le plateau. */
export function drawMoveIcon(moveClass: MoveClass): SVGGElement {
  const icon = ICONS[moveClass];
  const group = svgElement("g", { class: `move-icon move-${moveClass}` }) as SVGGElement;
  group.append(svgElement("path", { d: icon.shape, class: "move-icon-shape" }));
  if (icon.isPath) {
    group.append(svgElement("path", { d: icon.sign, class: "move-icon-stroke" }));
  } else if (icon.sign !== "") {
    const text = svgElement("text", { x: "10", y: moveClass === "blunder" ? "16" : "14.5", class: "move-icon-text" });
    text.textContent = icon.sign;
    group.append(text);
  }
  return group;
}

/** Icône autonome, décorative : l'avis est dit en toutes lettres à côté (libellé du bouton). */
export function createMoveIcon(moveClass: MoveClass): SVGSVGElement {
  const svg = svgElement("svg", { viewBox: "0 0 20 20", "aria-hidden": "true", focusable: "false", class: "move-icon-svg" }) as SVGSVGElement;
  svg.append(drawMoveIcon(moveClass));
  return svg;
}
