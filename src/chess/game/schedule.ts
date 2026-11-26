import type { ReviewState } from "./types.ts";

/** Ce que la révision espacée lit d'un exercice (problème, avantage à convertir, menace à voir). */
export interface Schedulable {
  readonly review: ReviewState;
  /** Fin de la partie d'origine, en secondes Unix : les nouveaux exercices vont des plus récents aux plus anciens. */
  readonly gameEndTime: number;
}

export const DAY_MS = 86_400_000;

/** Délais de révision, en jours : un échec renvoie au premier, chaque réussite passe au suivant. */
export const REVIEW_INTERVAL_DAYS: readonly number[] = [1, 3, 7, 21, 60];

/**
 * « Le lendemain » doit marcher même si la séance du jour suivant a lieu plus tôt dans la journée :
 * l'échéance est avancée de quelques heures.
 */
export const DUE_SLACK_MS = 8 * 3_600_000;

/** Problème jamais tenté : dû tout de suite. */
export const NEW_REVIEW: ReviewState = { step: -1, dueAt: 0, attempts: 0, successes: 0 };

/** `hinted` : trouvé avec l'indice. Compte comme une tentative, sans allonger le délai. */
export type ReviewOutcome = "solved" | "hinted" | "failed";

const LAST_STEP = REVIEW_INTERVAL_DAYS.length - 1;

function nextStep(step: number, outcome: ReviewOutcome): number {
  if (outcome === "failed") {
    return 0;
  }
  const currentStep = Math.max(step, 0);
  return outcome === "hinted" ? currentStep : Math.min(currentStep + 1, LAST_STEP);
}

/** Nouvel état de révision après une tentative : raté → demain, réussi → délai suivant (3, 7, 21, 60 jours). */
export function applyReview(state: ReviewState, outcome: ReviewOutcome, now: number): ReviewState {
  const step = nextStep(state.step, outcome);
  const intervalDays = REVIEW_INTERVAL_DAYS[step] ?? 1;
  return {
    step,
    dueAt: now + intervalDays * DAY_MS - DUE_SLACK_MS,
    attempts: state.attempts + 1,
    successes: state.successes + (outcome === "solved" ? 1 : 0),
  };
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.dueAt <= now;
}

function isNew(item: Schedulable): boolean {
  return item.review.step < 0;
}

/**
 * Exercices à faire maintenant : d'abord les révisions échues (la plus en retard en premier),
 * puis les nouveaux, des parties les plus récentes aux plus anciennes.
 */
export function selectSession<Item extends Schedulable>(items: readonly Item[], now: number): Item[] {
  const dueItems = items.filter((item) => isDue(item.review, now));
  const reviews = dueItems.filter((item) => !isNew(item)).sort((a, b) => a.review.dueAt - b.review.dueAt);
  const newItems = dueItems.filter(isNew).sort((a, b) => b.gameEndTime - a.gameEndTime);
  return [...reviews, ...newItems];
}

/** Date de la prochaine révision à venir, ou `null` s'il n'y en a aucune de programmée. */
export function nextDueAt(items: readonly Schedulable[], now: number): number | null {
  const upcoming = items.map((item) => item.review.dueAt).filter((dueAt) => dueAt > now);
  return upcoming.length === 0 ? null : Math.min(...upcoming);
}
