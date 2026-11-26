import type { AnalysedGame, TimeClass } from "./types.ts";

/** Une évolution se lit sur au moins deux semaines de parties. */
export const MIN_PROGRESS_WEEKS = 2;

const DAY_SECONDS = 86_400;
const DAY_MS = DAY_SECONDS * 1000;
/** Le 1er janvier 1970 était un jeudi : on recule de 3 jours pour caler les semaines sur le lundi. */
const THURSDAY_OFFSET_DAYS = 3;

/** Une semaine de parties dans une cadence. */
export interface WeekStat {
  /**
   * Lundi de la semaine, à minuit heure du joueur, exprimé comme une date UTC (millisecondes) :
   * à afficher avec le fuseau UTC pour retrouver le bon jour.
   */
  readonly weekStart: number;
  readonly gameCount: number;
  /** Moyenne des précisions des parties, de 0 à 100. */
  readonly accuracy: number;
  readonly blundersPerGame: number;
}

/**
 * Lundi de la semaine d'une partie. `utcOffsetMinutes` : comme `Date#getTimezoneOffset` (UTC moins
 * l'heure locale, −60 à Paris l'hiver), pour qu'une partie du dimanche soir reste dans sa semaine.
 */
export function weekStartOf(endTimeSeconds: number, utcOffsetMinutes: number): number {
  const localDays = Math.floor((endTimeSeconds - utcOffsetMinutes * 60) / DAY_SECONDS);
  const weekIndex = Math.floor((localDays + THURSDAY_OFFSET_DAYS) / 7);
  return (weekIndex * 7 - THURSDAY_OFFSET_DAYS) * DAY_MS;
}

/**
 * Progression d'une cadence, semaine par semaine (les plus anciennes d'abord, semaines sans partie
 * absentes) : précision moyenne et gaffes par partie, mêmes calculs que le bilan. Les parties sans
 * coup évalué ne comptent pas.
 */
export function weeklyProgress(games: readonly AnalysedGame[], timeClass: TimeClass, utcOffsetMinutes: number): WeekStat[] {
  const weeks = new Map<number, { gameCount: number; accuracySum: number; blunderCount: number }>();
  for (const game of games) {
    if (game.timeClass !== timeClass || game.moves.length === 0) {
      continue;
    }
    const weekStart = weekStartOf(game.endTime, utcOffsetMinutes);
    const week = weeks.get(weekStart) ?? { gameCount: 0, accuracySum: 0, blunderCount: 0 };
    weeks.set(weekStart, {
      gameCount: week.gameCount + 1,
      accuracySum: week.accuracySum + game.accuracy,
      blunderCount: week.blunderCount + game.moves.filter((move) => move.quality === "blunder").length,
    });
  }
  return [...weeks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([weekStart, week]) => ({
      weekStart,
      gameCount: week.gameCount,
      accuracy: week.accuracySum / week.gameCount,
      blundersPerGame: week.blunderCount / week.gameCount,
    }));
}
