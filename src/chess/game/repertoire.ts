import { classifyMove } from "./evaluation.ts";
import { indexReviews, reviewOf } from "./gaffes.ts";
import { UNKNOWN_OPENING, parseGame } from "./pgn.ts";
import { MAX_OPENINGS } from "./report.ts";
import { selectSession } from "./schedule.ts";
import type { AnalysedGame, DrillReview, GameTimeline, MoveReview, OpeningDrill, ParsedMove, PlayerColor } from "./types.ts";

/** L'ouverture s'arrête au 12e coup de chaque camp : au-delà, on juge la partie, plus le répertoire. */
export const REPERTOIRE_MAX_PLIES = 24;

/** Une ouverture du joueur, d'une couleur : ses parties, et les positions où il quitte le bon chemin. */
export interface OpeningRoute {
  readonly openingName: string;
  readonly playerColor: PlayerColor;
  readonly gameCount: number;
  /** Sorties de route, la plus fréquente d'abord (à égalité, la plus tôt dans la partie). */
  readonly drills: readonly OpeningDrill[];
}

export interface RepertoireSelection {
  readonly routes: readonly OpeningRoute[];
  readonly drills: readonly OpeningDrill[];
  /** Parties analysées avant la revue (sans PGN gardé) qui sortent de la route : à relire. */
  readonly gamesToPrepare: readonly AnalysedGame[];
}

/** Même position d'une partie à l'autre : pièces, trait, roques et prise en passant (sans compteurs). */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function openingDrillId(fen: string): string {
  return `${positionKey(fen)}:opening`;
}

function openingNameOf(game: AnalysedGame): string {
  return game.openingName === "Undefined" || game.openingName === "" ? UNKNOWN_OPENING : game.openingName;
}

function routeKey(openingName: string, color: PlayerColor): string {
  return `${color}|${openingName}`;
}

/**
 * Ouvertures fréquentes, par couleur : les `MAX_OPENINGS` plus jouées avec chaque couleur, comme
 * dans le bilan. Une ouverture inconnue n'a pas de chemin à apprendre : écartée.
 */
function frequentRoutes(games: readonly AnalysedGame[]): Map<string, { openingName: string; playerColor: PlayerColor; gameCount: number }> {
  const counts = new Map<string, { openingName: string; playerColor: PlayerColor; gameCount: number }>();
  for (const game of games) {
    const openingName = openingNameOf(game);
    if (game.moves.length === 0 || openingName === UNKNOWN_OPENING) {
      continue;
    }
    const key = routeKey(openingName, game.playerColor);
    const current = counts.get(key) ?? { openingName, playerColor: game.playerColor, gameCount: 0 };
    counts.set(key, { ...current, gameCount: current.gameCount + 1 });
  }
  const kept = (["white", "black"] as const).flatMap((color) =>
    [...counts.entries()]
      .filter(([, route]) => route.playerColor === color)
      .sort(([, left], [, right]) => right.gameCount - left.gameCount || left.openingName.localeCompare(right.openingName))
      .slice(0, MAX_OPENINGS),
  );
  return new Map(kept);
}

/** Premier coup du joueur, dans l'ouverture, que le moteur juge au moins imprécis. */
export function firstDeviation(game: AnalysedGame): MoveReview | null {
  return game.moves.find((move) => move.ply < REPERTOIRE_MAX_PLIES && move.quality !== "good") ?? null;
}

interface Sighting {
  readonly game: AnalysedGame;
  readonly move: MoveReview;
  readonly parsed: ParsedMove;
  readonly previousMoveUci: string | null;
  readonly bestUci: string;
}

/** La sortie de route d'une partie, avec sa position ; `null` si la partie reste sur la route ou s'il manque le coup du moteur. */
function sightingOf(game: AnalysedGame, timeline: GameTimeline, move: MoveReview): Sighting | null {
  const parsedMoves = parseGame(timeline.pgn)?.moves ?? [];
  const parsed = parsedMoves[move.ply];
  const bestUci = timeline.bestMoves[move.ply] ?? "";
  if (parsed === undefined || bestUci === "" || bestUci === parsed.uci) {
    return null;
  }
  return { game, move, parsed, previousMoveUci: parsedMoves[move.ply - 1]?.uci ?? null, bestUci };
}

function moveNumberOf(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

/** Ajoute une partie à l'exercice de sa position : le plus récent fournit la partie à revoir. */
function mergeSighting(existing: OpeningDrill | undefined, sighting: Sighting, reviews: ReadonlyMap<string, DrillReview>): OpeningDrill {
  const { game, move, parsed } = sighting;
  const playedSans = existing === undefined ? [] : existing.playedSans;
  const isLatest = existing === undefined || game.endTime > existing.gameEndTime;
  const base: OpeningDrill = existing ?? {
    id: openingDrillId(parsed.fenBefore),
    username: game.username,
    openingName: openingNameOf(game),
    playerColor: game.playerColor,
    fen: parsed.fenBefore,
    previousMoveUci: sighting.previousMoveUci,
    moveNumber: moveNumberOf(move.ply),
    bestUci: sighting.bestUci,
    cpBefore: move.cpBefore,
    playedSans: [],
    playedUcis: [],
    occurrences: 0,
    gameUrl: game.url,
    timeClass: game.timeClass,
    gameEndTime: game.endTime,
    review: reviewOf(reviews, openingDrillId(parsed.fenBefore)),
  };
  return {
    ...base,
    occurrences: base.occurrences + 1,
    playedSans: playedSans.includes(move.san) ? playedSans : [...playedSans, move.san],
    playedUcis: base.playedUcis.includes(parsed.uci) ? base.playedUcis : [...base.playedUcis, parsed.uci],
    ...(isLatest ? { gameUrl: game.url, timeClass: game.timeClass, gameEndTime: game.endTime } : {}),
  };
}

function byFrequency(left: OpeningDrill, right: OpeningDrill): number {
  return right.occurrences - left.occurrences || left.moveNumber - right.moveNumber;
}

/**
 * Répertoire à réviser : dans chaque ouverture fréquente (par couleur), le premier coup du joueur
 * que le moteur juge au moins imprécis avant le 13e coup. Les parties qui passent par la même
 * position forment un seul exercice : la position d'avant ce coup, réponse = coup du moteur ou
 * coup équivalent. Il faut le PGN gardé pour la revue : sinon, la partie est à relire.
 */
export function selectRepertoire(games: readonly AnalysedGame[], reviews: readonly DrillReview[]): RepertoireSelection {
  const routes = frequentRoutes(games);
  const reviewsById = indexReviews(reviews);
  const drillsByKey = new Map<string, OpeningDrill>();
  const routeOfDrill = new Map<string, string>();
  const gamesToPrepare: AnalysedGame[] = [];
  for (const game of games) {
    const key = routeKey(openingNameOf(game), game.playerColor);
    const deviation = routes.has(key) ? firstDeviation(game) : null;
    if (deviation === null) {
      continue;
    }
    if (game.timeline === undefined) {
      gamesToPrepare.push(game);
      continue;
    }
    const sighting = sightingOf(game, game.timeline, deviation);
    if (sighting !== null) {
      const id = openingDrillId(sighting.parsed.fenBefore);
      drillsByKey.set(id, mergeSighting(drillsByKey.get(id), sighting, reviewsById));
      routeOfDrill.set(id, routeOfDrill.get(id) ?? key);
    }
  }
  const drills = [...drillsByKey.values()].sort(byFrequency);
  const routeList = [...routes.entries()].map(([key, route]) => ({ ...route, drills: drills.filter((drill) => routeOfDrill.get(drill.id) === key) }));
  return { routes: routeList.sort((left, right) => right.gameCount - left.gameCount), drills, gamesToPrepare };
}

/**
 * Un autre coup que celui du moteur vaut autant s'il ne perd presque rien : « bon » au barème du
 * bilan (moins d'un demi-pion et de 2,5 points de chances de gain).
 */
export function isEquivalentMove(cpBefore: number, cpAfter: number): boolean {
  return classifyMove(cpBefore, cpAfter) === "good";
}

/** Ouverture choisie pour s'entraîner : son nom et la couleur jouée. */
export interface OpeningFocus {
  readonly openingName: string;
  readonly playerColor: PlayerColor;
}

/**
 * Séance : sans ouverture choisie, la révision espacée habituelle. Sur une ouverture, ses exercices
 * dus d'abord, puis les autres du plus proche de son échéance au plus lointain (à tout moment).
 */
export function selectOpeningSession(drills: readonly OpeningDrill[], now: number, focus: OpeningFocus | null): OpeningDrill[] {
  if (focus === null) {
    return selectSession(drills, now);
  }
  const focused = drills.filter((drill) => drill.openingName === focus.openingName && drill.playerColor === focus.playerColor);
  const due = selectSession(focused, now);
  const dueIds = new Set(due.map((drill) => drill.id));
  return [...due, ...focused.filter((drill) => !dueIds.has(drill.id)).sort((left, right) => left.review.dueAt - right.review.dueAt)];
}
