import { requireElement } from "../../shared/dom.ts";

/** Éléments du gabarit de l'entraîneur (problèmes). */
export interface Elements {
  readonly trainer: HTMLElement;
  readonly empty: HTMLElement;
  readonly counts: HTMLElement;
  readonly prompt: HTMLElement;
  readonly origin: HTMLElement;
  readonly feedback: HTMLElement;
  readonly hint: HTMLButtonElement;
  readonly solution: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly debrief: HTMLElement;
  readonly played: HTMLElement;
  readonly line: HTMLElement;
  readonly schedule: HTMLElement;
  readonly link: HTMLAnchorElement;
}

export function collectElements(): Elements {
  return {
    trainer: requireElement("trainer", HTMLElement),
    empty: requireElement("puzzle-empty", HTMLElement),
    counts: requireElement("puzzle-counts", HTMLElement),
    prompt: requireElement("puzzle-prompt", HTMLElement),
    origin: requireElement("puzzle-origin", HTMLElement),
    feedback: requireElement("puzzle-feedback", HTMLElement),
    hint: requireElement("hint", HTMLButtonElement),
    solution: requireElement("solution", HTMLButtonElement),
    next: requireElement("next", HTMLButtonElement),
    debrief: requireElement("puzzle-debrief", HTMLElement),
    played: requireElement("puzzle-played", HTMLElement),
    line: requireElement("puzzle-line", HTMLElement),
    schedule: requireElement("puzzle-schedule", HTMLElement),
    link: requireElement("puzzle-link", HTMLAnchorElement),
  };
}
