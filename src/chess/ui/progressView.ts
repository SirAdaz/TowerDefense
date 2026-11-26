import { requireElement, setText } from "../../shared/dom.ts";
import { MIN_PROGRESS_WEEKS } from "../game/progress.ts";
import type { WeekStat } from "../game/progress.ts";
import type { TimeClass } from "../game/types.ts";
import { TIME_CLASS_NAMES, formatDecimal, pluralize } from "./format.ts";
import { requireSvg } from "./reviewElements.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Repère des graphiques : proportions fixes (le texte n'est pas déformé), mis à la largeur du bloc. */
const WIDTH = 600;
const HEIGHT = 220;
const PAD = { left: 72, right: 12, top: 16, bottom: 40 } as const;
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
/** Au-delà de 8 semaines, une date sur deux ou plus sous l'axe, pour qu'elles ne se chevauchent pas. */
const MAX_X_LABELS = 8;
const DOT_RADIUS = 6;
const BAR_MAX_WIDTH = 40;
const BAR_RADIUS = 4;

const SHORT_WEEK = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const LONG_WEEK = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

interface Elements {
  readonly note: HTMLElement;
  readonly charts: HTMLElement;
  readonly accuracy: SVGSVGElement;
  readonly blunders: SVGSVGElement;
  readonly table: HTMLElement;
  readonly rows: HTMLElement;
}

/** Un graphique d'une seule mesure : ses valeurs, son échelle, et la bulle de chaque semaine. */
interface Series {
  readonly values: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly formatTick: (value: number) => string;
  readonly describe: (index: number) => string;
}

function svgElement(tagName: string, attributes: Readonly<Record<string, string>>, text = ""): SVGElement {
  const created = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    created.setAttribute(name, value);
  });
  created.textContent = text;
  return created;
}

function withTitle(mark: SVGElement, text: string): SVGElement {
  mark.append(svgElement("title", {}, text));
  return mark;
}

function xOf(index: number, count: number): number {
  return PAD.left + (PLOT_WIDTH / count) * (index + 0.5);
}

function yOf(series: Series, value: number): number {
  const span = series.max - series.min;
  return PAD.top + PLOT_HEIGHT - (span === 0 ? 0 : ((value - series.min) / span) * PLOT_HEIGHT);
}

/** Lignes de repère (bas, milieu, haut) avec leur valeur, et les dates sous l'axe. */
function axes(series: Series, weeks: readonly WeekStat[]): SVGElement[] {
  const ticks = [series.min, (series.min + series.max) / 2, series.max];
  const grid = ticks.flatMap((tick) => {
    const y = yOf(series, tick).toFixed(1);
    return [
      svgElement("line", { x1: String(PAD.left), x2: String(WIDTH - PAD.right), y1: y, y2: y, class: "chart-grid" }),
      svgElement("text", { x: String(PAD.left - 8), y, class: "chart-text", "text-anchor": "end", "dominant-baseline": "middle" }, series.formatTick(tick)),
    ];
  });
  const step = Math.ceil(weeks.length / MAX_X_LABELS);
  const labels = weeks
    .map((week, index) => ({ week, index }))
    .filter(({ index }) => index % step === 0)
    .map(({ week, index }) =>
      svgElement("text", { x: xOf(index, weeks.length).toFixed(1), y: String(HEIGHT - 10), class: "chart-text", "text-anchor": "middle" }, SHORT_WEEK.format(week.weekStart)),
    );
  return [...grid, ...labels];
}

function renderLine(svg: SVGSVGElement, series: Series, weeks: readonly WeekStat[]): void {
  const points = series.values.map((value, index) => ({ x: xOf(index, weeks.length), y: yOf(series, value) }));
  const dots = points.map((point, index) =>
    withTitle(svgElement("circle", { cx: point.x.toFixed(1), cy: point.y.toFixed(1), r: String(DOT_RADIUS), class: "week-dot" }), series.describe(index)),
  );
  const line = svgElement("polyline", { points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "), class: "week-line" });
  svg.replaceChildren(...axes(series, weeks), line, ...dots);
}

/** Barre au bout arrondi, posée sur l'axe. */
function barPath(x: number, top: number, width: number): string {
  const bottom = PAD.top + PLOT_HEIGHT;
  const radius = Math.min(BAR_RADIUS, (bottom - top) / 2, width / 2);
  const left = x - width / 2;
  const right = x + width / 2;
  return `M${left},${bottom} V${top + radius} Q${left},${top} ${left + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${bottom} Z`;
}

function renderBars(svg: SVGSVGElement, series: Series, weeks: readonly WeekStat[]): void {
  const width = Math.min(BAR_MAX_WIDTH, (PLOT_WIDTH / weeks.length) * 0.6);
  const bars = series.values.map((value, index) =>
    withTitle(svgElement("path", { d: barPath(xOf(index, weeks.length), yOf(series, value), width), class: "week-bar" }), series.describe(index)),
  );
  svg.replaceChildren(...axes(series, weeks), ...bars);
}

function accuracySeries(weeks: readonly WeekStat[]): Series {
  const values = weeks.map((week) => week.accuracy);
  return {
    values,
    min: Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10),
    max: Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10),
    formatTick: (value) => `${Math.round(value)} %`,
    describe: (index) => `Semaine du ${LONG_WEEK.format(weeks[index]?.weekStart ?? 0)} : précision ${formatDecimal(values[index] ?? 0)} %`,
  };
}

function blunderSeries(weeks: readonly WeekStat[]): Series {
  const values = weeks.map((week) => week.blundersPerGame);
  return {
    values,
    min: 0,
    max: Math.max(1, Math.ceil(Math.max(...values))),
    formatTick: (value) => formatDecimal(value),
    describe: (index) => `Semaine du ${LONG_WEEK.format(weeks[index]?.weekStart ?? 0)} : ${formatDecimal(values[index] ?? 0)} gaffe(s) par partie`,
  };
}

function tableRow(week: WeekStat): HTMLElement {
  const row = document.createElement("tr");
  const cells = [LONG_WEEK.format(week.weekStart), String(week.gameCount), `${formatDecimal(week.accuracy)} %`, formatDecimal(week.blundersPerGame)];
  cells.forEach((text, index) => {
    const cell = document.createElement(index === 0 ? "th" : "td");
    if (index === 0) {
      cell.setAttribute("scope", "row");
    } else {
      cell.className = "number";
    }
    cell.textContent = text;
    row.append(cell);
  });
  return row;
}

function describeNote(weeks: readonly WeekStat[], timeClass: TimeClass): string {
  const name = TIME_CLASS_NAMES[timeClass];
  if (weeks.length >= MIN_PROGRESS_WEEKS) {
    return `${pluralize(weeks.length, "semaine", "semaines")} avec des parties en ${name}. Le tableau sous les graphiques donne les mêmes chiffres.`;
  }
  return `Encore trop peu de semaines pour voir une évolution : il en faut au moins ${MIN_PROGRESS_WEEKS} avec des parties en ${name}. Revenez après une autre semaine de jeu.`;
}

export interface ProgressView {
  render(weeks: readonly WeekStat[], timeClass: TimeClass): void;
}

/** Bloc « Progression semaine par semaine » du bilan : deux graphiques (une mesure chacun) et leur tableau. */
export function createProgressView(): ProgressView {
  const elements: Elements = {
    note: requireElement("report-progress-note", HTMLElement),
    charts: requireElement("report-progress-charts", HTMLElement),
    accuracy: requireSvg("report-progress-accuracy"),
    blunders: requireSvg("report-progress-blunders"),
    table: requireElement("report-progress-table", HTMLElement),
    rows: requireElement("report-progress-rows", HTMLElement),
  };
  [elements.accuracy, elements.blunders].forEach((svg) => {
    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  });
  return {
    render: (weeks, timeClass) => {
      setText(elements.note, describeNote(weeks, timeClass));
      const hasCurve = weeks.length >= MIN_PROGRESS_WEEKS;
      elements.charts.hidden = !hasCurve;
      elements.table.hidden = weeks.length === 0;
      elements.rows.replaceChildren(...weeks.map(tableRow));
      if (hasCurve) {
        renderLine(elements.accuracy, accuracySeries(weeks), weeks);
        renderBars(elements.blunders, blunderSeries(weeks), weeks);
      }
    },
  };
}
