import { requireElement, setText } from "../../shared/dom.ts";
import { formatLine, frenchSan } from "../game/notation.ts";
import { applyReview, selectSession } from "../game/schedule.ts";
import type { ReviewOutcome } from "../game/schedule.ts";
import type { Puzzle } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardView } from "./board.ts";
import { describeDelay, formatDay, TIME_CLASS_NAMES } from "./format.ts";
import { askPromotion, describeCounts, describeEmpty, describeRightMove, describeWrongMove, playUci } from "./puzzleText.ts";

export interface PuzzleViewOptions {
  /** Garde le nouvel état de révision d'un problème. */
  readonly onReviewed: (puzzle: Puzzle) => void;
  readonly now: () => number;
}

export interface PuzzleView {
  /** Donne la liste à jour des problèmes du joueur ; celui en cours n'est pas interrompu. */
  setPuzzles(puzzles: readonly Puzzle[]): void;
}

interface Attempt {
  hasFailed: boolean;
  hasHint: boolean;
  isOver: boolean;
}

interface Elements {
  readonly trainer: HTMLElement;
  readonly empty: HTMLElement;
  readonly counts: HTMLElement;
  readonly prompt: HTMLElement;
  readonly origin: HTMLElement;
  readonly feedback: HTMLElement;
  readonly hint: HTMLButtonElement;
  readonly solution: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly debrief: HTMLElement;
  readonly played: HTMLElement;
  readonly line: HTMLElement;
  readonly schedule: HTMLElement;
  readonly link: HTMLAnchorElement;
}

/** Séance en cours : la file des problèmes à faire, celui affiché et où en est la tentative. */
interface Session {
  readonly options: PuzzleViewOptions;
  readonly elements: Elements;
  readonly board: BoardView;
  puzzles: readonly Puzzle[];
  queue: Puzzle[];
  current: Puzzle | null;
  attempt: Attempt;
}

function collectElements(): Elements {
  return {
    trainer: requireElement("trainer", HTMLElement),
    empty: requireElement("puzzle-empty", HTMLElement),
    counts: requireElement("puzzle-counts", HTMLElement),
    prompt: requireElement("puzzle-prompt", HTMLElement),
    origin: requireElement("puzzle-origin", HTMLElement),
    feedback: requireElement("puzzle-feedback", HTMLElement),
    hint: requireElement("hint", HTMLButtonElement),
    solution: requireElement("solution", HTMLButtonElement),
    next: requireElement("next", HTMLButtonElement),
    debrief: requireElement("puzzle-debrief", HTMLElement),
    played: requireElement("puzzle-played", HTMLElement),
    line: requireElement("puzzle-line", HTMLElement),
    schedule: requireElement("puzzle-schedule", HTMLElement),
    link: requireElement("puzzle-link", HTMLAnchorElement),
  };
}

function newAttempt(): Attempt {
  return { hasFailed: false, hasHint: false, isOver: false };
}

function outcomeOf(attempt: Attempt): ReviewOutcome {
  if (attempt.hasFailed) {
    return "failed";
  }
  return attempt.hasHint ? "hinted" : "solved";
}

function isSolving(session: Session): boolean {
  return session.current !== null && !session.attempt.isOver;
}

function renderCounts(session: Session): void {
  const dueCount = session.queue.length + (isSolving(session) ? 1 : 0);
  setText(session.elements.counts, describeCounts(session.puzzles, dueCount));
}

function showPuzzlePosition(session: Session, puzzle: Puzzle, hintSquare: string | null): void {
  session.board.show({
    fen: puzzle.fen,
    orientation: puzzle.playerColor,
    lastMoveUci: puzzle.previousMoveUci,
    hintSquare,
    isInteractive: true,
  });
}

function setSolvingControls(elements: Elements, isSolvingNow: boolean): void {
  elements.debrief.hidden = isSolvingNow;
  elements.hint.hidden = !isSolvingNow;
  elements.solution.hidden = !isSolvingNow;
  elements.next.hidden = isSolvingNow;
}

/** Clôt la tentative : le résultat est gardé, la correction s'affiche avec le coup joué sur le plateau. */
function finish(session: Session, puzzle: Puzzle, playedUci: string): void {
  const { elements, options } = session;
  session.attempt.isOver = true;
  const review = applyReview(puzzle.review, outcomeOf(session.attempt), options.now());
  const reviewed: Puzzle = { ...puzzle, review };
  session.puzzles = session.puzzles.map((candidate) => (candidate.id === reviewed.id ? reviewed : candidate));
  options.onReviewed(reviewed);
  const fen = playUci(puzzle.fen, playedUci)?.fen ?? puzzle.fen;
  session.board.show({ fen, orientation: puzzle.playerColor, lastMoveUci: playedUci, hintSquare: null, isInteractive: false });
  setText(elements.played, `Dans la partie, vous aviez joué ${frenchSan(puzzle.playedSan)}.`);
  setText(elements.line, `Meilleure suite : ${formatLine(puzzle.fen, puzzle.solutionLine)}`);
  setText(elements.schedule, `Ce problème reviendra ${describeDelay(review.dueAt, options.now())}.`);
  elements.link.href = puzzle.gameUrl;
  setSolvingControls(elements, false);
  elements.next.focus();
  renderCounts(session);
}

function handleMove(session: Session, uci: string): void {
  const puzzle = session.current;
  if (puzzle === null || session.attempt.isOver) {
    return;
  }
  const moveName = playUci(puzzle.fen, uci)?.san ?? uci;
  if (!puzzle.solutions.some((solution) => solution.uci === uci)) {
    session.attempt.hasFailed = true;
    setText(session.elements.feedback, describeWrongMove(puzzle, moveName));
    showPuzzlePosition(session, puzzle, null);
    return;
  }
  setText(session.elements.feedback, describeRightMove(puzzle, uci, moveName));
  finish(session, puzzle, uci);
}

function showNext(session: Session): void {
  const { elements, options } = session;
  const puzzle = session.queue.shift() ?? null;
  session.current = puzzle;
  session.attempt = newAttempt();
  elements.trainer.hidden = puzzle === null;
  elements.empty.hidden = puzzle !== null;
  setText(elements.empty, describeEmpty(session.puzzles, options.now()));
  renderCounts(session);
  if (puzzle === null) {
    return;
  }
  const sideName = puzzle.playerColor === "white" ? "blancs" : "noirs";
  const gameDay = formatDay(puzzle.gameEndTime * 1000);
  setText(elements.prompt, `Trait aux ${sideName}. Trouvez le meilleur coup.`);
  setText(elements.origin, `Position tirée de votre partie ${TIME_CLASS_NAMES[puzzle.timeClass]} du ${gameDay}.`);
  setText(elements.feedback, "");
  setSolvingControls(elements, true);
  showPuzzlePosition(session, puzzle, null);
}

function giveHint(session: Session): void {
  const origin = session.current?.solutions[0]?.uci.slice(0, 2);
  if (session.current === null || origin === undefined || session.attempt.isOver) {
    return;
  }
  session.attempt.hasHint = true;
  setText(session.elements.feedback, `Indice : la pièce à jouer est en ${origin}.`);
  showPuzzlePosition(session, session.current, origin);
}

function revealSolution(session: Session): void {
  const bestMove = session.current?.solutions[0];
  if (session.current === null || bestMove === undefined || session.attempt.isOver) {
    return;
  }
  session.attempt.hasFailed = true;
  setText(session.elements.feedback, `Solution : ${frenchSan(bestMove.san)}.`);
  finish(session, session.current, bestMove.uci);
}

/** L'entraîneur : un problème à la fois, tiré des gaffes du joueur, puis sa correction. */
export function createPuzzleView(options: PuzzleViewOptions): PuzzleView {
  const elements = collectElements();
  const promotionDialog = requireElement("promotion", HTMLDialogElement);
  const board = createBoard({
    root: requireElement("board", HTMLElement),
    onMove: (uci) => {
      handleMove(session, uci);
    },
    choosePromotion: () => askPromotion(promotionDialog),
  });
  const session: Session = { options, elements, board, puzzles: [], queue: [], current: null, attempt: newAttempt() };

  elements.hint.addEventListener("click", () => {
    giveHint(session);
  });
  elements.solution.addEventListener("click", () => {
    revealSolution(session);
  });
  elements.next.addEventListener("click", () => {
    showNext(session);
  });

  return {
    setPuzzles: (puzzles) => {
      const shownId = session.current?.id;
      session.puzzles = puzzles;
      session.queue = selectSession(puzzles, options.now()).filter((puzzle) => puzzle.id !== shownId);
      // Rien d'affiché, ou un problème qui n'existe plus (pseudo oublié) : on passe au suivant.
      if (!puzzles.some((puzzle) => puzzle.id === shownId)) {
        showNext(session);
      } else {
        renderCounts(session);
      }
    },
  };
}
