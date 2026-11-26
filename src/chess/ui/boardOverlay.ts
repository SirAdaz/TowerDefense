import { arrowPoints, SQUARE_UNITS } from "../game/arrow.ts";
import type { PlayerColor } from "../game/types.ts";

/** Flèche dessinée sur le plateau : `best` pour le coup du moteur, `played` pour un coup à éviter. */
export interface BoardArrow {
  readonly uci: string;
  readonly tone: "best" | "played";
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Calque au-dessus des cases : purement visuel, le texte à côté du plateau dit la même chose. */
export function createArrowLayer(root: HTMLElement): SVGSVGElement {
  const layer = document.createElementNS(SVG_NS, "svg");
  const size = String(SQUARE_UNITS * 8);
  layer.setAttribute("viewBox", `0 0 ${size} ${size}`);
  layer.setAttribute("class", "board-arrows");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("focusable", "false");
  root.append(layer);
  return layer;
}

export function drawArrows(layer: SVGSVGElement, arrows: readonly BoardArrow[], orientation: PlayerColor): void {
  const shapes = arrows.flatMap((arrow) => {
    const points = arrowPoints(arrow.uci, orientation);
    if (points === null) {
      return [];
    }
    const shape = document.createElementNS(SVG_NS, "polygon");
    shape.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    shape.setAttribute("class", `arrow arrow-${arrow.tone}`);
    return [shape];
  });
  layer.replaceChildren(...shapes);
}
