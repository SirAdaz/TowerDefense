import { requireElement } from "../../shared/dom.ts";

/** Éléments du gabarit de la revue de partie. */
export interface ReviewElements {
  readonly section: HTMLElement;
  readonly picker: HTMLElement;
  readonly list: HTMLElement;
  readonly review: HTMLElement;
  readonly back: HTMLButtonElement;
  readonly title: HTMLElement;
  readonly progress: HTMLElement;
  readonly progressBar: HTMLProgressElement;
  readonly progressLabel: HTMLElement;
  readonly cancel: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly body: HTMLElement;
  readonly whiteName: HTMLElement;
  readonly blackName: HTMLElement;
  readonly summary: HTMLElement;
  readonly evalFill: HTMLElement;
  readonly comment: HTMLElement;
  readonly first: HTMLButtonElement;
  readonly prev: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly last: HTMLButtonElement;
  readonly explore: HTMLButtonElement;
  readonly exploreExit: HTMLButtonElement;
  readonly moves: HTMLElement;
  readonly evalChart: SVGSVGElement;
  readonly timeChart: SVGSVGElement;
  readonly timeText: HTMLElement;
}

/** Comme `requireElement`, pour un graphique SVG de la page. */
export function requireSvg(id: string): SVGSVGElement {
  const found = document.getElementById(id);
  if (!(found instanceof SVGSVGElement)) {
    throw new Error(`Missing element #${id}`);
  }
  return found;
}

export function collectReviewElements(): ReviewElements {
  return {
    section: requireElement("games", HTMLElement),
    picker: requireElement("game-picker", HTMLElement),
    list: requireElement("game-list", HTMLElement),
    review: requireElement("review", HTMLElement),
    back: requireElement("review-back", HTMLButtonElement),
    title: requireElement("review-title", HTMLElement),
    progress: requireElement("review-progress", HTMLElement),
    progressBar: requireElement("review-progress-bar", HTMLProgressElement),
    progressLabel: requireElement("review-progress-label", HTMLElement),
    cancel: requireElement("review-cancel", HTMLButtonElement),
    status: requireElement("review-status", HTMLElement),
    body: requireElement("review-body", HTMLElement),
    whiteName: requireElement("review-white-name", HTMLElement),
    blackName: requireElement("review-black-name", HTMLElement),
    summary: requireElement("review-summary", HTMLElement),
    evalFill: requireElement("review-evalbar-fill", HTMLElement),
    comment: requireElement("review-comment", HTMLElement),
    first: requireElement("review-first", HTMLButtonElement),
    prev: requireElement("review-prev", HTMLButtonElement),
    next: requireElement("review-next", HTMLButtonElement),
    last: requireElement("review-last", HTMLButtonElement),
    explore: requireElement("review-explore", HTMLButtonElement),
    exploreExit: requireElement("review-explore-exit", HTMLButtonElement),
    moves: requireElement("review-moves", HTMLElement),
    evalChart: requireSvg("review-eval-chart"),
    timeChart: requireSvg("review-time-chart"),
    timeText: requireElement("review-time-text", HTMLElement),
  };
}
