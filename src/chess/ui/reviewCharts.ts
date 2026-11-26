import type { GameReviewData, PlyReview } from "../game/gameReview.ts";
import { ZEITNOT_SECONDS } from "../game/gameReview.ts";
import type { PlayerColor } from "../game/types.ts";
import { formatSeconds, moveNumberLabel } from "../game/reviewFormat.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Repère des deux graphiques : 1000 unités de large, étirées à la largeur de la page. */
const WIDTH = 1000;
const EVAL_HEIGHT = 120;
const TIME_HEIGHT = 80;

/** Coups dont l'avis est marqué sur la courbe : ceux qu'on veut retrouver d'un coup d'œil. */
const MARKED_CLASSES: ReadonlySet<string> = new Set(["blunder", "mistake", "miss", "brilliant"]);

function svgElement(tagName: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const created = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    created.setAttribute(name, value);
  });
  return created;
}

function xOf(index: number, plyCount: number): number {
  return plyCount === 0 ? 0 : (index / plyCount) * WIDTH;
}

function cursor(index: number, plyCount: number, height: number): SVGElement {
  const x = xOf(index, plyCount).toFixed(1);
  return svgElement("line", { x1: x, x2: x, y1: "0", y2: String(height), class: "chart-cursor" });
}

/**
 * Courbe des chances des blancs, coup après coup : la zone claire est la part des blancs. Les gaffes,
 * erreurs, occasions manquées et coups brillants y sont marqués d'un trait vertical.
 */
export function renderEvalChart(svg: SVGSVGElement, review: GameReviewData, index: number): void {
  const plyCount = review.plies.length;
  const yOf = (win: number) => (EVAL_HEIGHT - (win / 100) * EVAL_HEIGHT).toFixed(1);
  const wins = [review.whiteWinStart, ...review.plies.map((ply) => ply.whiteWinAfter)];
  const points = wins.map((win, position) => `${xOf(position, plyCount).toFixed(1)},${yOf(win)}`);
  const area = `M0,${EVAL_HEIGHT} L${points.join(" L")} L${WIDTH},${EVAL_HEIGHT} Z`;
  const marks = review.plies
    .filter((ply) => MARKED_CLASSES.has(ply.moveClass))
    .map((ply) => {
      const x = xOf(ply.ply + 1, plyCount).toFixed(1);
      return svgElement("line", { x1: x, x2: x, y1: "0", y2: String(EVAL_HEIGHT), class: `chart-mark mark-${ply.moveClass}` });
    });
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${EVAL_HEIGHT}`);
  svg.replaceChildren(
    svgElement("path", { d: area, class: "chart-white" }),
    svgElement("line", { x1: "0", x2: String(WIDTH), y1: String(EVAL_HEIGHT / 2), y2: String(EVAL_HEIGHT / 2), class: "chart-mid" }),
    ...marks,
    cursor(index, plyCount, EVAL_HEIGHT),
  );
}

function barClass(ply: PlyReview): string {
  if (ply.isZeitnot) {
    return "time-bar time-zeitnot";
  }
  return ply.isLongThink ? "time-bar time-long" : `time-bar time-${ply.color}`;
}

/**
 * Temps passé sur chaque coup : barres vers le haut pour les blancs, vers le bas pour les noirs.
 * Rouge : coup joué sous 10 s à la pendule ; ambre : coup long.
 */
export function renderTimeChart(svg: SVGSVGElement, review: GameReviewData, index: number): void {
  const plyCount = review.plies.length;
  const longest = Math.max(1, ...review.plies.map((ply) => ply.spentSeconds ?? 0));
  const half = TIME_HEIGHT / 2;
  const slot = WIDTH / Math.max(1, plyCount);
  const bars = review.plies.map((ply) => {
    const height = Math.max(1, ((ply.spentSeconds ?? 0) / longest) * (half - 2));
    const top = ply.color === "white" ? half - height : half;
    return svgElement("rect", {
      x: (xOf(ply.ply + 1, plyCount) - slot * 0.9).toFixed(1),
      y: top.toFixed(1),
      width: (slot * 0.8).toFixed(1),
      height: height.toFixed(1),
      class: barClass(ply),
    });
  });
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${TIME_HEIGHT}`);
  svg.replaceChildren(
    svgElement("line", { x1: "0", x2: String(WIDTH), y1: String(half), y2: String(half), class: "chart-mid" }),
    ...bars,
    cursor(index, plyCount, TIME_HEIGHT),
  );
}

/** Position (0 = départ, n = après le n-ième demi-coup) visée par un clic sur un graphique. */
export function indexFromPointer(svg: SVGSVGElement, clientX: number, plyCount: number): number {
  const box = svg.getBoundingClientRect();
  const ratio = box.width === 0 ? 0 : (clientX - box.left) / box.width;
  return Math.max(0, Math.min(plyCount, Math.round(ratio * plyCount)));
}

function describeSide(review: GameReviewData, color: PlayerColor, name: string): string {
  const own = review.plies.filter((ply) => ply.color === color && ply.spentSeconds !== null);
  const longest = own.reduce<PlyReview | null>((best, ply) => ((ply.spentSeconds ?? 0) > (best?.spentSeconds ?? -1) ? ply : best), null);
  const zeitnotCount = own.filter((ply) => ply.isZeitnot).length;
  const longText = longest === null ? "" : `coup le plus long ${formatSeconds(longest.spentSeconds ?? 0)} (${moveNumberLabel(longest)})`;
  const zeitnotText = zeitnotCount === 0 ? "aucun coup en zeitnot" : `${zeitnotCount} coup${zeitnotCount > 1 ? "s" : ""} joué${zeitnotCount > 1 ? "s" : ""} sous ${ZEITNOT_SECONDS} s`;
  return `${name} : ${longText}, ${zeitnotText}.`;
}

/** Résumé du temps en toutes lettres (le graphique n'est qu'un dessin) ; sans pendule, on le dit. */
export function describeTime(review: GameReviewData): string {
  if (review.plies.every((ply) => ply.spentSeconds === null)) {
    return "Cette partie n'a pas de pendule enregistrée : pas de temps par coup.";
  }
  return `${describeSide(review, "white", review.whiteName)} ${describeSide(review, "black", review.blackName)}`;
}
