import { describe, expect, it } from "vitest";
import { puzzle } from "../../../tests/chessFixtures.ts";
import { DAY_MS, DUE_SLACK_MS, NEW_REVIEW, applyReview, isDue, nextDueAt, selectSession } from "./schedule.ts";
import type { ReviewState } from "./types.ts";

const NOW = 1_800_000_000_000;

function daysUntilDue(state: ReviewState): number {
  return (state.dueAt + DUE_SLACK_MS - NOW) / DAY_MS;
}

describe("spaced repetition", () => {
  it("brings a failed puzzle back the next day", () => {
    const failed = applyReview(NEW_REVIEW, "failed", NOW);
    expect(failed.step).toBe(0);
    expect(daysUntilDue(failed)).toBe(1);
    expect(failed).toMatchObject({ attempts: 1, successes: 0 });
  });

  it("then spaces successes at 3, 7, 21 and 60 days", () => {
    let state = applyReview(NEW_REVIEW, "failed", NOW);
    const intervals: number[] = [];
    for (let round = 0; round < 5; round += 1) {
      state = applyReview(state, "solved", NOW);
      intervals.push(daysUntilDue(state));
    }
    expect(intervals).toEqual([3, 7, 21, 60, 60]);
    expect(state.successes).toBe(5);
  });

  it("sends a puzzle solved at first sight three days away", () => {
    expect(daysUntilDue(applyReview(NEW_REVIEW, "solved", NOW))).toBe(3);
  });

  it("resets the interval after a failure, however far the puzzle was", () => {
    const mastered: ReviewState = { step: 4, dueAt: NOW, attempts: 6, successes: 5 };
    const failed = applyReview(mastered, "failed", NOW);
    expect(daysUntilDue(failed)).toBe(1);
    expect(failed).toMatchObject({ attempts: 7, successes: 5 });
  });

  it("does not lengthen the interval when the hint was used", () => {
    expect(daysUntilDue(applyReview(NEW_REVIEW, "hinted", NOW))).toBe(1);
    const atSevenDays: ReviewState = { step: 2, dueAt: NOW, attempts: 3, successes: 2 };
    const hinted = applyReview(atSevenDays, "hinted", NOW);
    expect(daysUntilDue(hinted)).toBe(7);
    expect(hinted.successes).toBe(2);
  });

  it("makes « tomorrow » due the next morning, not exactly 24 hours later", () => {
    const failed = applyReview(NEW_REVIEW, "failed", NOW);
    expect(isDue(failed, NOW + 12 * 3_600_000)).toBe(false);
    expect(isDue(failed, NOW + 17 * 3_600_000)).toBe(true);
  });
});

describe("session order", () => {
  const overdue = puzzle({ id: "overdue", review: { step: 0, dueAt: NOW - 3 * DAY_MS, attempts: 1, successes: 0 } });
  const dueToday = puzzle({ id: "due", review: { step: 1, dueAt: NOW - 1000, attempts: 2, successes: 1 } });
  const later = puzzle({ id: "later", review: { step: 2, dueAt: NOW + 2 * DAY_MS, attempts: 3, successes: 2 } });
  const muchLater = puzzle({ id: "much-later", review: { step: 3, dueAt: NOW + 9 * DAY_MS, attempts: 4, successes: 3 } });
  const newOld = puzzle({ id: "new-old", gameEndTime: 100 });
  const newRecent = puzzle({ id: "new-recent", gameEndTime: 200 });

  it("puts overdue reviews first, then new puzzles from the latest games, and leaves the rest", () => {
    const session = selectSession([newOld, later, dueToday, newRecent, overdue], NOW);
    expect(session.map((item) => item.id)).toEqual(["overdue", "due", "new-recent", "new-old"]);
  });

  it("gives the date of the next review to come", () => {
    expect(nextDueAt([muchLater, later, overdue, newOld], NOW)).toBe(later.review.dueAt);
    expect(nextDueAt([overdue, newOld], NOW)).toBeNull();
  });
});
