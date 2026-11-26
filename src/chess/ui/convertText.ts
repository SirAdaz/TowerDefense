import { requireElement } from "../../shared/dom.ts";
import { CONVERSION_MOVES } from "../game/conversion.ts";
import type { ConversionVerdict } from "../game/conversion.ts";
import { formatPawnsSigned } from "../game/explore.ts";
import { nextDueAt } from "../game/schedule.ts";
import { countSolved } from "../game/summary.ts";
import type { ConversionDrill } from "../game/types.ts";
import { describeDelay, pluralize } from "./format.ts";

/** Éléments du gabarit « Convertir un avantage ». */
export interface ConvertElements {
  readonly section: HTMLElement;
  readonly counts: HTMLElement;
  readonly level: HTMLSelectElement;
  readonly empty: HTMLElement;
  readonly trainer: HTMLElement;
  readonly prompt: HTMLElement;
  readonly origin: HTMLElement;
  readonly step: HTMLElement;
  readonly evalFill: HTMLElement;
  readonly evaluation: HTMLElement;
  readonly feedback: HTMLElement;
  readonly hint: HTMLButtonElement;
  readonly resign: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly debrief: HTMLElement;
  readonly played: HTMLElement;
  readonly schedule: HTMLElement;
  readonly link: HTMLAnchorElement;
}

export function collectConvertElements(): ConvertElements {
  return {
    section: requireElement("convert", HTMLElement),
    counts: requireElement("convert-counts", HTMLElement),
    level: requireElement("convert-level", HTMLSelectElement),
    empty: requireElement("convert-empty", HTMLElement),
    trainer: requireElement("convert-trainer", HTMLElement),
    prompt: requireElement("convert-prompt", HTMLElement),
    origin: requireElement("convert-origin", HTMLElement),
    step: requireElement("convert-step", HTMLElement),
    evalFill: requireElement("convert-eval-fill", HTMLElement),
    evaluation: requireElement("convert-eval", HTMLElement),
    feedback: requireElement("convert-feedback", HTMLElement),
    hint: requireElement("convert-hint", HTMLButtonElement),
    resign: requireElement("convert-resign", HTMLButtonElement),
    next: requireElement("convert-next", HTMLButtonElement),
    debrief: requireElement("convert-debrief", HTMLElement),
    played: requireElement("convert-played", HTMLElement),
    schedule: requireElement("convert-schedule", HTMLElement),
    link: requireElement("convert-link", HTMLAnchorElement),
  };
}

/** Fin d'une partie jouée depuis la position, y compris l'abandon demandé par le joueur. */
export type ConvertEnd = Exclude<ConversionVerdict, { status: "playing" }>["reason"] | "gaveUp";

const END_TEXTS: Readonly<Record<ConvertEnd, string>> = {
  mate: "Échec et mat : l'avantage est converti.",
  resigned: "Le moteur abandonne : vous valez plus de +10. Avantage converti.",
  held: `${CONVERSION_MOVES} coups joués et l'avantage tient : exercice réussi.`,
  dropped: "Ce coup fait tomber l'avantage sous +1 : exercice raté. Le meilleur coup est en flèche verte.",
  notEnough: `Après ${CONVERSION_MOVES} coups, l'avantage n'atteint plus +1,5 : exercice raté.`,
  draw: "Partie nulle : l'avantage n'est pas converti.",
  mated: "Vous êtes maté : exercice raté.",
  gaveUp: "Abandon : l'exercice compte comme raté.",
};

export function describeEnd(end: ConvertEnd): string {
  return END_TEXTS[end];
}

export function describePrompt(drill: ConversionDrill): string {
  const side = drill.playerColor === "white" ? "blancs" : "noirs";
  return `Trait aux ${side}. Vous êtes à ${formatPawnsSigned(drill.startCp)} : gagnez la partie.`;
}

export function describeStep(playerMoves: number): string {
  return playerMoves === 0
    ? `À vous de jouer : ${CONVERSION_MOVES} coups à tenir.`
    : `Coup ${playerMoves} sur ${CONVERSION_MOVES}.`;
}

export function describeConvertCounts(drills: readonly ConversionDrill[], dueCount: number): string {
  if (drills.length === 0) {
    return "";
  }
  return `${dueCount} à faire · ${drills.length} en tout · ${pluralize(countSolved(drills), "réussi", "réussis")}`;
}

export function describeConvertEmpty(drills: readonly ConversionDrill[], now: number): string {
  if (drills.length === 0) {
    return "Aucune position pour l'instant : elles viennent des gaffes faites alors que vous gagniez (+1,5 ou mieux).";
  }
  const nextDue = nextDueAt(drills, now);
  return `Tout est fait pour aujourd'hui.${nextDue === null ? "" : ` Prochaine révision ${describeDelay(nextDue, now)}.`}`;
}
