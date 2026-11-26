import { UNKNOWN_OPENING } from "./pgn.ts";
import type { AnalysedGame, LostPhase, MoveReview, TimeClass } from "./types.ts";

/** « Sous 10 secondes » : la pendule du joueur après son coup, telle que le PGN la note. */
export const LOW_CLOCK_SECONDS = 10;

/** Ouvertures listées dans le bilan : les plus jouées, le reste n'a pas assez de parties pour dire quoi que ce soit. */
export const MAX_OPENINGS = 6;

export const TIME_CLASSES: readonly TimeClass[] = ["bullet", "blitz", "rapid"];

export interface OpeningStat {
  readonly name: string;
  readonly gameCount: number;
  readonly winCount: number;
  /** Part de victoires, de 0 à 100. */
  readonly winRate: number;
  /** PGN de la partie la plus récente de cette ouverture qui l'a gardé : ses premiers coups illustrent l'ouverture. */
  readonly pgn: string | null;
}

/** En dessous de 5 parties, la part de victoires d'une ouverture ne dit presque rien. */
export const SMALL_SAMPLE_GAMES = 5;

/** Erreurs (gaffes et erreurs) rapportées au nombre de coups joués dans la même situation de pendule. */
export interface ClockPressure {
  readonly moveCount: number;
  readonly errorCount: number;
  /** Erreurs pour 100 coups ; 0 sans coup. */
  readonly errorRate: number;
}

/** Bilan d'une cadence. Les cadences ne sont jamais additionnées : on ne joue pas le même jeu en 1 et en 10 minutes. */
export interface TimeClassReport {
  readonly timeClass: TimeClass;
  readonly gameCount: number;
  readonly winCount: number;
  readonly drawCount: number;
  readonly lossCount: number;
  /** Moyenne des précisions des parties, de 0 à 100. */
  readonly accuracy: number;
  readonly blundersPerGame: number;
  readonly mistakesPerGame: number;
  readonly openings: readonly OpeningStat[];
  /** Nombre de parties perdues par phase où elles ont basculé. */
  readonly lostPhases: Readonly<Record<LostPhase, number>>;
  /** `null` quand aucune partie de la cadence n'a d'horloge. */
  readonly lowClock: ClockPressure | null;
  readonly otherClock: ClockPressure | null;
}

function isError(move: MoveReview): boolean {
  return move.quality === "blunder" || move.quality === "mistake";
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function countMoves(games: readonly AnalysedGame[], isCounted: (move: MoveReview) => boolean): number {
  return games.reduce((total, game) => total + game.moves.filter(isCounted).length, 0);
}

function toPressure(moves: readonly MoveReview[]): ClockPressure {
  const errorCount = moves.filter(isError).length;
  return { moveCount: moves.length, errorCount, errorRate: 100 * ratio(errorCount, moves.length) };
}

/** Ouvertures les plus jouées, avec leur part de victoires ; à égalité, ordre alphabétique. */
export function openingStats(games: readonly AnalysedGame[]): OpeningStat[] {
  const byName = new Map<string, { gameCount: number; winCount: number; pgn: string | null; pgnEndTime: number }>();
  for (const game of games) {
    // Parties gardées avant que « Undefined » (page du site) ne soit lu comme une ouverture inconnue.
    const name = game.openingName === "Undefined" ? UNKNOWN_OPENING : game.openingName;
    const tally = byName.get(name) ?? { gameCount: 0, winCount: 0, pgn: null, pgnEndTime: -1 };
    tally.gameCount += 1;
    tally.winCount += game.result === "win" ? 1 : 0;
    if (game.timeline !== undefined && game.endTime > tally.pgnEndTime) {
      tally.pgn = game.timeline.pgn;
      tally.pgnEndTime = game.endTime;
    }
    byName.set(name, tally);
  }
  return [...byName.entries()]
    .map(([name, tally]) => ({
      name,
      gameCount: tally.gameCount,
      winCount: tally.winCount,
      winRate: 100 * ratio(tally.winCount, tally.gameCount),
      pgn: tally.pgn,
    }))
    .sort((a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name))
    .slice(0, MAX_OPENINGS);
}

function countLostPhases(games: readonly AnalysedGame[]): Record<LostPhase, number> {
  const counts: Record<LostPhase, number> = { opening: 0, middlegame: 0, endgame: 0, other: 0 };
  for (const game of games) {
    if (game.lostPhase !== null) {
      counts[game.lostPhase] += 1;
    }
  }
  return counts;
}

/**
 * Bilan des parties d'une cadence, ou `null` s'il n'y en a aucune. Les parties sans coup évalué
 * (illisibles, trop courtes) sont ignorées : elles ne sont gardées que pour ne pas être redemandées.
 */
export function buildReport(allGames: readonly AnalysedGame[], timeClass: TimeClass): TimeClassReport | null {
  const games = allGames.filter((game) => game.timeClass === timeClass && game.moves.length > 0);
  if (games.length === 0) {
    return null;
  }
  const timedMoves = games.flatMap((game) => game.moves).filter((move) => move.clockSeconds !== null);
  const lowClockMoves = timedMoves.filter((move) => (move.clockSeconds ?? 0) < LOW_CLOCK_SECONDS);
  const otherMoves = timedMoves.filter((move) => (move.clockSeconds ?? 0) >= LOW_CLOCK_SECONDS);
  const hasClocks = timedMoves.length > 0;
  return {
    timeClass,
    gameCount: games.length,
    winCount: games.filter((game) => game.result === "win").length,
    drawCount: games.filter((game) => game.result === "draw").length,
    lossCount: games.filter((game) => game.result === "loss").length,
    accuracy: ratio(games.reduce((total, game) => total + game.accuracy, 0), games.length),
    blundersPerGame: ratio(countMoves(games, (move) => move.quality === "blunder"), games.length),
    mistakesPerGame: ratio(countMoves(games, (move) => move.quality === "mistake"), games.length),
    openings: openingStats(games),
    lostPhases: countLostPhases(games),
    lowClock: hasClocks ? toPressure(lowClockMoves) : null,
    otherClock: hasClocks ? toPressure(otherMoves) : null,
  };
}
