import { requireElement, setText } from "../../shared/dom.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { formatLine, frenchSan } from "../game/notation.ts";
import { applyReview, selectSession } from "../game/schedule.ts";
import type { ReviewOutcome } from "../game/schedule.ts";
import type { Puzzle } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardView } from "./board.ts";
import type { BoardArrow } from "./boardOverlay.ts";
import { createExploreView } from "./exploreView.ts";
import type { ExploreView } from "./exploreView.ts";
import { describeDelay, formatDay, TIME_CLASS_NAMES } from "./format.ts";
import { collectElements } from "./puzzleElements.ts";
import type { Elements } from "./puzzleElements.ts";
import { askPromotion, describeCounts, describeEmpty, describeRightMove, describeWrongMove, playUci } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface PuzzleViewOptions {
  /** Garde le nouvel état de révision d'un problème. */
  readonly onReviewed: (puzzle: Puzzle) => void;
  readonly now: () => number;
  readonly sound: SoundPlayer;
  /** Moteur de l'exploration d'après problème, lancé au premier besoin. */
  readonly engine: ExploreEngine;
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


/** Séance en cours : la file des problèmes à faire, celui affiché et où en est la tentative. */
interface Session {
  readonly options: PuzzleViewOptions;
  readonly elements: Elements;
  readonly board: BoardView;
  readonly explore: ExploreView;
  puzzles: readonly Puzzle[];
  queue: Puzzle[];
  current: Puzzle | null;
  attempt: Attempt;
  /** Minuteries en cours (retour de la pièce, annonce) : annulées dès que le problème change d'état. */
  timers: number[];
  /** Coup qui a clos le problème (trouvé ou solution) : « Continuer à jouer » repart de là. */
  solvedUci: string;
}

/** Un coup refusé reste ce temps sur le plateau, en rouge, avant que la pièce revienne à sa place. */
const WRONG_MOVE_MS = 700;

/** Le son de réussite suit celui du coup, comme une ponctuation. */
const SUCCESS_SOUND_DELAY_MS = 180;

/** Vider puis réécrire le message : deux erreurs identiques de suite sont relues aux lecteurs d'écran. */
const ANNOUNCE_DELAY_MS = 60;


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

function later(session: Session, action: () => void, delayMs: number): void {
  session.timers.push(window.setTimeout(action, delayMs));
}

function clearTimers(session: Session): void {
  session.timers.forEach((timer) => {
    window.clearTimeout(timer);
  });
  session.timers = [];
}

function announce(session: Session, text: string): void {
  setText(session.elements.feedback, "");
  later(
    session,
    () => {
      setText(session.elements.feedback, text);
    },
    ANNOUNCE_DELAY_MS,
  );
}

function renderCounts(session: Session): void {
  const dueCount = session.queue.length + (isSolving(session) ? 1 : 0);
  setText(session.elements.counts, describeCounts(session.puzzles, dueCount));
}

/** La position du problème, prête à jouer ; la case de l'indice reste en vue une fois demandée. */
function showPuzzlePosition(session: Session, puzzle: Puzzle): void {
  const hintSquare = session.attempt.hasHint ? (puzzle.solutions[0]?.uci.slice(0, 2) ?? null) : null;
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

/** Flèche du meilleur coup quand le joueur en a trouvé un autre qui le vaut (ou quand la solution est montrée). */
function bestMoveArrows(puzzle: Puzzle, playedUci: string, isFound: boolean): BoardArrow[] {
  const bestMove = puzzle.solutions[0];
  if (bestMove === undefined || (isFound && bestMove.uci === playedUci)) {
    return [];
  }
  return [{ uci: bestMove.uci, tone: "best" }];
}

/** Clôt la tentative : le résultat est gardé, la correction s'affiche avec le coup joué sur le plateau. */
function finish(session: Session, puzzle: Puzzle, playedUci: string, isFound: boolean): void {
  const { elements, options } = session;
  clearTimers(session);
  session.attempt.isOver = true;
  const review = applyReview(puzzle.review, outcomeOf(session.attempt), options.now());
  const reviewed: Puzzle = { ...puzzle, review };
  session.puzzles = session.puzzles.map((candidate) => (candidate.id === reviewed.id ? reviewed : candidate));
  options.onReviewed(reviewed);
  const fen = playUci(puzzle.fen, playedUci)?.fen ?? puzzle.fen;
  session.board.show({
    fen,
    orientation: puzzle.playerColor,
    lastMoveUci: playedUci,
    hintSquare: null,
    isInteractive: false,
    arrows: bestMoveArrows(puzzle, playedUci, isFound),
    marks: isFound ? [{ square: playedUci.slice(2, 4), tone: "success" }] : [],
  });
  setText(elements.played, `Dans la partie, vous aviez joué ${frenchSan(puzzle.playedSan)}.`);
  setText(elements.line, `Meilleure suite : ${formatLine(puzzle.fen, puzzle.solutionLine)}`);
  setText(elements.schedule, `Ce problème reviendra ${describeDelay(review.dueAt, options.now())}.`);
  elements.link.href = puzzle.gameUrl;
  session.solvedUci = playedUci;
  session.explore.open(reviewed);
  setSolvingControls(elements, false);
  elements.next.focus();
  renderCounts(session);
}

/** Coup refusé : il reste un instant en rouge, le plateau tremble, puis la pièce revient à sa place. */
function rejectMove(session: Session, puzzle: Puzzle, uci: string): void {
  const played = playUci(puzzle.fen, uci);
  clearTimers(session);
  session.attempt.hasFailed = true;
  session.options.sound.play("error");
  announce(session, describeWrongMove(puzzle, played?.san ?? uci));
  session.board.show({
    fen: played?.fen ?? puzzle.fen,
    orientation: puzzle.playerColor,
    lastMoveUci: null,
    hintSquare: null,
    isInteractive: false,
    marks: [
      { square: uci.slice(0, 2), tone: "error" },
      { square: uci.slice(2, 4), tone: "error" },
    ],
  });
  session.board.shake();
  later(
    session,
    () => {
      showPuzzlePosition(session, puzzle);
    },
    WRONG_MOVE_MS,
  );
}

function handleMove(session: Session, uci: string): void {
  if (session.explore.handleMove(uci)) {
    return;
  }
  const puzzle = session.current;
  if (puzzle === null || session.attempt.isOver) {
    return;
  }
  if (!puzzle.solutions.some((solution) => solution.uci === uci)) {
    rejectMove(session, puzzle, uci);
    return;
  }
  const played = playUci(puzzle.fen, uci);
  session.options.sound.play(played?.sound ?? "move");
  session.options.sound.play("success", SUCCESS_SOUND_DELAY_MS);
  setText(session.elements.feedback, describeRightMove(puzzle, uci, played?.san ?? uci));
  finish(session, puzzle, uci, true);
}

function showNext(session: Session): void {
  const { elements, options } = session;
  const puzzle = session.queue.shift() ?? null;
  clearTimers(session);
  session.explore.close();
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
  showPuzzlePosition(session, puzzle);
}

function giveHint(session: Session): void {
  const origin = session.current?.solutions[0]?.uci.slice(0, 2);
  if (session.current === null || origin === undefined || session.attempt.isOver) {
    return;
  }
  clearTimers(session);
  session.attempt.hasHint = true;
  setText(session.elements.feedback, `Indice : la pièce à jouer est en ${origin}, entourée sur le plateau.`);
  showPuzzlePosition(session, session.current);
}

function revealSolution(session: Session): void {
  const bestMove = session.current?.solutions[0];
  if (session.current === null || bestMove === undefined || session.attempt.isOver) {
    return;
  }
  session.attempt.hasFailed = true;
  session.options.sound.play(playUci(session.current.fen, bestMove.uci)?.sound ?? "move");
  setText(session.elements.feedback, `Solution : ${frenchSan(bestMove.san)}, en flèche sur le plateau.`);
  finish(session, session.current, bestMove.uci, false);
}

function attachExploreButtons(session: Session): void {
  const actions: Readonly<Record<string, () => void>> = {
    "explore-continue": () => {
      session.explore.continueWith(session.solvedUci);
    },
    "explore-line": () => {
      session.explore.showLine();
    },
    "explore-game": () => {
      session.explore.showGameMove();
    },
    "explore-reset": () => {
      session.explore.reset();
    },
  };
  Object.entries(actions).forEach(([id, action]) => {
    requireElement(id, HTMLButtonElement).addEventListener("click", action);
  });
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
  const explore = createExploreView({ board, sound: options.sound, engine: options.engine, prefix: "explore", root: elements.trainer });
  const session: Session = {
    options,
    elements,
    board,
    explore,
    puzzles: [],
    queue: [],
    current: null,
    attempt: newAttempt(),
    timers: [],
    solvedUci: "",
  };
  attachExploreButtons(session);

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
