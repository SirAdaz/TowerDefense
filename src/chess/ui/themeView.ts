import { requireElement, setText } from "../../shared/dom.ts";
import { THEME_NAMES, themeStats } from "../game/themes.ts";
import type { TacticTheme, ThemeStat } from "../game/themes.ts";
import type { Puzzle } from "../game/types.ts";
import { pluralize } from "./format.ts";

export interface ThemeViewOptions {
  readonly themeOf: (puzzle: Puzzle) => TacticTheme;
  /** Restreint l'entraîneur à un thème (`null` : tous les problèmes). */
  readonly onFilter: (theme: TacticTheme | null) => void;
}

export interface ThemeView {
  setPuzzles(puzzles: readonly Puzzle[]): void;
}

interface Elements {
  readonly block: HTMLElement;
  readonly list: HTMLElement;
  readonly filter: HTMLElement;
  readonly filterText: HTMLElement;
  readonly clear: HTMLButtonElement;
  readonly prompt: HTMLElement;
}

/** « 25 % (1 sur 4) », ou « pas encore tenté ». */
export function describeSuccess(stat: ThemeStat): string {
  if (stat.successRate === null) {
    return "pas encore tenté à l'entraînement";
  }
  return `réussite ${Math.round(stat.successRate * 100)} % à l'entraînement (${stat.successes} sur ${stat.attempts})`;
}

function themeItem(stat: ThemeStat, onTrain: (theme: TacticTheme) => void): HTMLElement {
  const item = document.createElement("li");
  item.className = "theme-item";
  const name = document.createElement("strong");
  name.textContent = THEME_NAMES[stat.theme];
  const details = document.createElement("span");
  details.className = "theme-details";
  details.textContent = `raté ${stat.count} fois en partie · ${describeSuccess(stat)}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = "S'entraîner";
  button.setAttribute("aria-label", `S'entraîner sur le thème ${THEME_NAMES[stat.theme]}`);
  button.addEventListener("click", () => {
    onTrain(stat.theme);
  });
  const text = document.createElement("div");
  text.append(name, details);
  item.append(text, button);
  return item;
}

/** Bilan des thèmes ratés (sous l'entraîneur) et filtre « s'entraîner sur ce thème ». */
export function createThemeView(options: ThemeViewOptions): ThemeView {
  const elements: Elements = {
    block: requireElement("themes", HTMLElement),
    list: requireElement("themes-list", HTMLElement),
    filter: requireElement("themes-filter", HTMLElement),
    filterText: requireElement("themes-filter-text", HTMLElement),
    clear: requireElement("themes-clear", HTMLButtonElement),
    prompt: requireElement("puzzle-prompt", HTMLElement),
  };
  let stats: ThemeStat[] = [];
  const applyFilter = (theme: TacticTheme | null) => {
    const count = stats.find((stat) => stat.theme === theme)?.count ?? 0;
    elements.filter.hidden = theme === null;
    setText(elements.filterText, theme === null ? "" : `Entraînement sur un thème : ${THEME_NAMES[theme]} (${pluralize(count, "problème", "problèmes")}).`);
    options.onFilter(theme);
    elements.filter.scrollIntoView({ block: "start" });
    elements.prompt.focus();
  };
  elements.prompt.tabIndex = -1;
  elements.clear.addEventListener("click", () => {
    applyFilter(null);
  });
  return {
    setPuzzles: (puzzles) => {
      stats = themeStats(puzzles, options.themeOf);
      elements.block.hidden = stats.length === 0;
      elements.list.replaceChildren(...stats.map((stat) => themeItem(stat, applyFilter)));
    },
  };
}
