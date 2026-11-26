import { requireElement } from "../../shared/dom.ts";
import { nextDueAt } from "../game/schedule.ts";
import { countSolved } from "../game/summary.ts";
import type { DefenseDrill } from "../game/types.ts";
import { describeDelay, pluralize } from "./format.ts";

/** Éléments du gabarit « Voir la menace ». */
export interface DefendElements {
  readonly section: HTMLElement;
  readonly counts: HTMLElement;
  readonly empty: HTMLElement;
  readonly trainer: HTMLElement;
  readonly boardHelp: HTMLElement;
  readonly prompt: HTMLElement;
  readonly origin: HTMLElement;
  readonly feedback: HTMLElement;
  readonly reveal: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly debrief: HTMLElement;
  readonly played: HTMLElement;
  readonly schedule: HTMLElement;
  readonly link: HTMLAnchorElement;
}

export function collectDefendElements(): DefendElements {
  return {
    section: requireElement("defend", HTMLElement),
    counts: requireElement("defend-counts", HTMLElement),
    empty: requireElement("defend-empty", HTMLElement),
    trainer: requireElement("defend-trainer", HTMLElement),
    boardHelp: requireElement("defend-board-help", HTMLElement),
    prompt: requireElement("defend-prompt", HTMLElement),
    origin: requireElement("defend-origin", HTMLElement),
    feedback: requireElement("defend-feedback", HTMLElement),
    reveal: requireElement("defend-reveal", HTMLButtonElement),
    next: requireElement("defend-next", HTMLButtonElement),
    debrief: requireElement("defend-debrief", HTMLElement),
    played: requireElement("defend-played", HTMLElement),
    schedule: requireElement("defend-schedule", HTMLElement),
    link: requireElement("defend-link", HTMLAnchorElement),
  };
}

export const SPOT_PROMPT = "Que menace l'adversaire ?";

export const SPOT_HELP =
  "Désignez une case : la pièce adverse qui menace, ou la pièce ou la case menacée. Au clavier : flèches pour changer de case, Entrée pour choisir.";

export const PARRY_PROMPT = "Parez la menace : jouez un coup qui garde la position.";

export const PARRY_HELP =
  "Glissez une pièce, ou choisissez-la puis sa case d'arrivée. Au clavier : flèches pour changer de case, Entrée pour choisir.";

export function describeWrongSquare(square: string): string {
  return `Non : rien de concret en ${square}. Cherchez ce que l'adversaire peut prendre avec gain, ou mater, au prochain coup.`;
}

export function describeDefendCounts(drills: readonly DefenseDrill[], dueCount: number): string {
  if (drills.length === 0) {
    return "";
  }
  return `${dueCount} à faire · ${drills.length} en tout · ${pluralize(countSolved(drills), "réussi", "réussis")}`;
}

export function describeDefendEmpty(drills: readonly DefenseDrill[], now: number): string {
  if (drills.length === 0) {
    return "Aucune position pour l'instant : elles viennent des gaffes qui ont laissé passer une prise gagnante ou un mat adverse.";
  }
  const nextDue = nextDueAt(drills, now);
  return `Tout est fait pour aujourd'hui.${nextDue === null ? "" : ` Prochaine révision ${describeDelay(nextDue, now)}.`}`;
}
