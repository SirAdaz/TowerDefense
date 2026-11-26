import { arrowPoints, squareCenter, SQUARE_UNITS } from "../game/arrow.ts";
import type { MoveClass } from "../game/moveClass.ts";
import type { PlayerColor } from "../game/types.ts";
import { drawMoveIcon } from "./moveIcons.ts";

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

/** Avis sur le coup affiché, posé en coin de sa case d'arrivée (revue de partie). */
export interface BoardBadge {
  readonly square: string;
  readonly moveClass: MoveClass;
}

/** Taille de l'icône sur le plateau (unités du dessin) : un bon tiers de case. */
const BADGE_SCALE = 1.7;

function badgeShape(badge: BoardBadge, orientation: PlayerColor): SVGGElement[] {
  const center = squareCenter(badge.square, orientation);
  if (center === null) {
    return [];
  }
  const icon = drawMoveIcon(badge.moveClass);
  const left = center.x + SQUARE_UNITS / 2 - 20 * BADGE_SCALE + 4;
  const top = center.y - SQUARE_UNITS / 2 - 4;
  icon.setAttribute("transform", `translate(${left} ${top}) scale(${BADGE_SCALE})`);
  icon.classList.add("board-badge");
  return [icon];
}

export function drawArrows(
  layer: SVGSVGElement,
  arrows: readonly BoardArrow[],
  orientation: PlayerColor,
  badge: BoardBadge | null = null,
): void {
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
  layer.replaceChildren(...shapes, ...(badge === null ? [] : badgeShape(badge, orientation)));
}
