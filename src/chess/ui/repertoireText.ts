import { requireElement } from "../../shared/dom.ts";
import { frenchSan } from "../game/notation.ts";
import { openingLine } from "../game/openingGuide.ts";
import type { OpeningFocus, OpeningRoute } from "../game/repertoire.ts";
import { nextDueAt } from "../game/schedule.ts";
import { countSolved } from "../game/summary.ts";
import type { OpeningDrill, PlayerColor } from "../game/types.ts";
import { describeDelay, pluralize } from "./format.ts";

/** Éléments du gabarit « Votre répertoire ». */
export interface RepertoireElements {
  readonly section: HTMLElement;
  readonly counts: HTMLElement;
  readonly empty: HTMLElement;
  readonly trainer: HTMLElement;
  readonly prompt: HTMLElement;
  readonly origin: HTMLElement;
  readonly feedback: HTMLElement;
  readonly reveal: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly debrief: HTMLElement;
  readonly played: HTMLElement;
  readonly schedule: HTMLElement;
  readonly link: HTMLAnchorElement;
  readonly routes: HTMLElement;
  readonly routesList: HTMLElement;
  readonly filter: HTMLElement;
  readonly filterText: HTMLElement;
  readonly clear: HTMLButtonElement;
}

export function collectRepertoireElements(): RepertoireElements {
  const element = (id: string) => requireElement(`repertoire${id}`, HTMLElement);
  return {
    section: element(""),
    counts: element("-counts"),
    empty: element("-empty"),
    trainer: element("-trainer"),
    prompt: element("-prompt"),
    origin: element("-origin"),
    feedback: element("-feedback"),
    reveal: requireElement("repertoire-reveal", HTMLButtonElement),
    next: requireElement("repertoire-next", HTMLButtonElement),
    debrief: element("-debrief"),
    played: element("-played"),
    schedule: element("-schedule"),
    link: requireElement("repertoire-link", HTMLAnchorElement),
    routes: element("-routes"),
    routesList: element("-routes-list"),
    filter: element("-filter"),
    filterText: element("-filter-text"),
    clear: requireElement("repertoire-clear", HTMLButtonElement),
  };
}

const COLOR_NAMES: Readonly<Record<PlayerColor, string>> = { white: "avec les blancs", black: "avec les noirs" };

export function describeFocus(focus: OpeningFocus, count: number): string {
  return `Entraînement sur une ouverture : ${focus.openingName}, ${COLOR_NAMES[focus.playerColor]} (${pluralize(count, "position", "positions")}).`;
}

/** « Coup 4, vous avez joué Cg5 ou Cc3 (2 parties) » : où la route se quitte, sans dire le bon coup. */
export function describeExit(drill: OpeningDrill): string {
  const moves = drill.playedSans.map(frenchSan).join(" ou ");
  return `Coup ${drill.moveNumber} : vous avez joué ${moves} (${pluralize(drill.occurrences, "partie", "parties")})`;
}

export function describeRepertoireCounts(drills: readonly OpeningDrill[], dueCount: number): string {
  if (drills.length === 0) {
    return "";
  }
  return `${dueCount} à faire · ${drills.length} en tout · ${pluralize(countSolved(drills), "réussie", "réussies")}`;
}

export function describeRepertoireEmpty(drills: readonly OpeningDrill[], now: number): string {
  if (drills.length === 0) {
    return "Aucune sortie de route pour l'instant dans vos ouvertures les plus jouées.";
  }
  const nextDue = nextDueAt(drills, now);
  return `Tout est fait pour aujourd'hui.${nextDue === null ? "" : ` Prochaine révision ${describeDelay(nextDue, now)}.`}`;
}

function routeHeading(route: OpeningRoute): HTMLElement {
  const heading = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = route.openingName;
  const details = document.createElement("span");
  details.className = "theme-details";
  details.textContent = `${COLOR_NAMES[route.playerColor]} · ${pluralize(route.gameCount, "partie", "parties")}`;
  heading.append(name, details);
  const idea = openingLine(route.openingName, null)?.idea ?? null;
  if (idea !== null) {
    const ideaText = document.createElement("span");
    ideaText.className = "theme-details";
    ideaText.textContent = idea;
    heading.append(ideaText);
  }
  return heading;
}

function exitList(route: OpeningRoute): HTMLElement {
  if (route.drills.length === 0) {
    const none = document.createElement("span");
    none.textContent = "Aucune sortie de route repérée dans ces parties.";
    return none;
  }
  const list = document.createElement("ul");
  list.className = "route-exits";
  list.append(
    ...route.drills.map((drill) => {
      const item = document.createElement("li");
      item.textContent = describeExit(drill);
      return item;
    }),
  );
  return list;
}

/** Une ouverture du bilan « là où vous sortez de la route », avec son bouton d'entraînement. */
export function routeItem(route: OpeningRoute, onTrain: (focus: OpeningFocus) => void): HTMLElement {
  const item = document.createElement("li");
  item.className = "theme-item route-item";
  const text = routeHeading(route);
  text.append(exitList(route));
  item.append(text);
  if (route.drills.length > 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = "S'entraîner";
    button.setAttribute("aria-label", `S'entraîner sur ${route.openingName}, ${COLOR_NAMES[route.playerColor]}`);
    button.addEventListener("click", () => {
      onTrain({ openingName: route.openingName, playerColor: route.playerColor });
    });
    item.append(button);
  }
  return item;
}
