import { DAY_MS } from "../game/schedule.ts";
import type { TimeClass } from "../game/types.ts";

export const TIME_CLASS_NAMES: Readonly<Record<TimeClass, string>> = { bullet: "bullet", blitz: "blitz", rapid: "rapide" };

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** « 12 novembre » */
export function formatDay(timestamp: number): string {
  return DAY_FORMAT.format(timestamp);
}

/** « 1 partie », « 3 parties » : le nombre et le mot accordé. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Échéance dite simplement : « aujourd'hui », « demain », « dans 3 jours ». */
export function describeDelay(dueAt: number, now: number): string {
  const days = Math.ceil((dueAt - now) / DAY_MS);
  if (days <= 0) {
    return "aujourd'hui";
  }
  return days === 1 ? "demain" : `dans ${days} jours`;
}

/** Durée restante arrondie pour une barre de progression : « moins d'une minute », « environ 3 min ». */
export function describeRemaining(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes < 1 ? "moins d'une minute" : `environ ${minutes} min`;
}
