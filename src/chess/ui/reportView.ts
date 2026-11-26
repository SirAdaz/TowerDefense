import { requireElement, setText } from "../../shared/dom.ts";
import { weeklyProgress } from "../game/progress.ts";
import { LOW_CLOCK_SECONDS, TIME_CLASSES, buildReport } from "../game/report.ts";
import type { ClockPressure, TimeClassReport } from "../game/report.ts";
import type { AnalysedGame, LostPhase, TimeClass } from "../game/types.ts";
import { TIME_CLASS_NAMES, formatDecimal, pluralize } from "./format.ts";
import { openingCell, winRateCell } from "./openingView.ts";
import { createProgressView } from "./progressView.ts";
import type { ProgressView } from "./progressView.ts";

export interface ReportView {
  /** Donne les parties analysées du joueur ; le bilan affiché est recalculé. */
  setGames(games: readonly AnalysedGame[]): void;
}

interface Elements {
  readonly panel: HTMLElement;
  readonly tabs: readonly HTMLButtonElement[];
  readonly body: HTMLElement;
  readonly empty: HTMLElement;
  readonly stats: HTMLElement;
  readonly openings: HTMLElement;
  readonly lostTitle: HTMLElement;
  readonly lostPhases: HTMLElement;
  readonly clock: HTMLElement;
  readonly progress: ProgressView;
}

const PHASE_NAMES: Readonly<Record<LostPhase, string>> = {
  opening: "Ouverture",
  middlegame: "Milieu de jeu",
  endgame: "Finale",
  other: "Sans position perdante (temps, abandon)",
};

const PHASE_ORDER: readonly LostPhase[] = ["opening", "middlegame", "endgame", "other"];

function collectElements(): Elements {
  const panel = requireElement("report", HTMLElement);
  return {
    panel,
    tabs: [...panel.querySelectorAll<HTMLButtonElement>("[data-time-class]")],
    body: requireElement("report-body", HTMLElement),
    empty: requireElement("report-empty", HTMLElement),
    stats: requireElement("report-stats", HTMLElement),
    openings: requireElement("report-openings", HTMLElement),
    lostTitle: requireElement("report-lost-title", HTMLElement),
    lostPhases: requireElement("report-lost", HTMLElement),
    clock: requireElement("report-clock", HTMLElement),
    progress: createProgressView(),
  };
}

function element(tagName: string, className: string, text = ""): HTMLElement {
  const created = document.createElement(tagName);
  created.className = className;
  created.textContent = text;
  return created;
}

function statTile(label: string, figure: string, detail: string): HTMLElement {
  const tile = element("div", "stat");
  tile.append(element("dt", "stat-label", label), element("dd", "stat-value", figure));
  if (detail !== "") {
    tile.append(element("dd", "stat-detail", detail));
  }
  return tile;
}

function renderStats(container: HTMLElement, report: TimeClassReport): void {
  const record = `${report.winCount} V · ${report.drawCount} N · ${report.lossCount} D`;
  container.replaceChildren(
    statTile("Parties analysées", String(report.gameCount), record),
    statTile("Précision moyenne", `${formatDecimal(report.accuracy)} %`, ""),
    statTile("Gaffes par partie", formatDecimal(report.blundersPerGame), "2 pions perdus ou plus"),
    statTile("Erreurs par partie", formatDecimal(report.mistakesPerGame), "1 à 2 pions perdus"),
  );
}

function renderOpenings(tableBody: HTMLElement, report: TimeClassReport): void {
  const rows = report.openings.map((opening) => {
    const row = document.createElement("tr");
    row.append(openingCell(opening), element("td", "number", String(opening.gameCount)), winRateCell(opening));
    return row;
  });
  tableBody.replaceChildren(...rows);
}

/** Une ligne par phase : le nombre de défaites, sa part, et une barre dont la longueur redit cette part. */
function phaseRow(phase: LostPhase, lostCount: number, lossCount: number): HTMLElement {
  const share = lossCount === 0 ? 0 : (100 * lostCount) / lossCount;
  const row = element("li", "phase");
  const track = element("span", "phase-bar");
  const fill = element("span", "phase-fill");
  fill.style.width = `${share}%`;
  track.setAttribute("aria-hidden", "true");
  track.append(fill);
  row.append(element("span", "phase-name", PHASE_NAMES[phase]), element("span", "phase-count", `${lostCount} (${Math.round(share)} %)`), track);
  return row;
}

function renderLostPhases(elements: Elements, report: TimeClassReport): void {
  const title = report.lossCount === 0 ? "Aucune défaite analysée" : `Où vos ${pluralize(report.lossCount, "défaite a", "défaites ont")} basculé`;
  setText(elements.lostTitle, title);
  elements.lostPhases.hidden = report.lossCount === 0;
  elements.lostPhases.replaceChildren(...PHASE_ORDER.map((phase) => phaseRow(phase, report.lostPhases[phase], report.lossCount)));
}

function describeClock(lowClock: ClockPressure | null, otherClock: ClockPressure | null): string {
  if (lowClock === null || otherClock === null) {
    return "Ces parties n'ont pas d'horloge : impossible de dire ce qui se passe en fin de pendule.";
  }
  if (lowClock.moveCount === 0) {
    return `Aucun coup joué avec moins de ${LOW_CLOCK_SECONDS} secondes à la pendule.`;
  }
  const lowRate = formatDecimal(lowClock.errorRate);
  const otherRate = formatDecimal(otherClock.errorRate);
  const errors = pluralize(lowClock.errorCount, "gaffe ou erreur", "gaffes ou erreurs");
  const moves = pluralize(lowClock.moveCount, "coup joué", "coups joués");
  return `Sous ${LOW_CLOCK_SECONDS} secondes à la pendule : ${errors} en ${moves}, soit ${lowRate} pour 100 coups, contre ${otherRate} le reste du temps.`;
}

function render(elements: Elements, games: readonly AnalysedGame[], timeClass: TimeClass): void {
  const report = buildReport(games, timeClass);
  elements.tabs.forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset["timeClass"] === timeClass));
  });
  elements.body.hidden = report === null;
  elements.empty.hidden = report !== null;
  setText(elements.empty, `Aucune partie analysée en ${TIME_CLASS_NAMES[timeClass]} pour l'instant.`);
  if (report === null) {
    return;
  }
  renderStats(elements.stats, report);
  // Semaines calées sur l'heure du joueur : une partie du dimanche soir reste dans sa semaine.
  elements.progress.render(weeklyProgress(games, timeClass, new Date().getTimezoneOffset()), timeClass);
  renderOpenings(elements.openings, report);
  renderLostPhases(elements, report);
  setText(elements.clock, describeClock(report.lowClock, report.otherClock));
}

function busiestTimeClass(games: readonly AnalysedGame[]): TimeClass {
  const countOf = (timeClass: TimeClass) => buildReport(games, timeClass)?.gameCount ?? 0;
  return [...TIME_CLASSES].sort((a, b) => countOf(b) - countOf(a))[0] ?? "blitz";
}

/** Le bilan : une cadence à la fois (bullet, blitz, rapide), jamais mélangées. */
export function createReportView(): ReportView {
  const elements = collectElements();
  let games: readonly AnalysedGame[] = [];
  // Tant que le joueur n'a rien choisi, la cadence la plus jouée s'affiche (elle peut changer pendant l'analyse).
  let chosen: TimeClass | null = null;

  const renderSelected = () => {
    const hasGames = games.some((game) => game.moves.length > 0);
    elements.panel.hidden = !hasGames;
    if (hasGames) {
      render(elements, games, chosen ?? busiestTimeClass(games));
    }
  };

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      chosen = TIME_CLASSES.find((timeClass) => timeClass === tab.dataset["timeClass"]) ?? chosen;
      renderSelected();
    });
  });

  return {
    setGames: (nextGames) => {
      games = nextGames;
      renderSelected();
    },
  };
}
