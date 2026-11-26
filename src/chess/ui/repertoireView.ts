import { requireElement, setText } from "../../shared/dom.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { lineToSan } from "../game/analysis.ts";
import { frenchSan } from "../game/notation.ts";
import { selectOpeningSession } from "../game/repertoire.ts";
import type { OpeningFocus, OpeningRoute } from "../game/repertoire.ts";
import { applyReview } from "../game/schedule.ts";
import type { DrillReview, OpeningDrill } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardView } from "./board.ts";
import { createExploreView } from "./exploreView.ts";
import type { ExploreView } from "./exploreView.ts";
import { TIME_CLASS_NAMES, describeDelay, formatDay } from "./format.ts";
import { askPromotion, playUci } from "./puzzleText.ts";
import { judgeOpeningMove } from "./repertoireJudge.ts";
import {
  collectRepertoireElements,
  describeExit,
  describeFocus,
  describeRepertoireCounts,
  describeRepertoireEmpty,
  routeItem,
} from "./repertoireText.ts";
import type { RepertoireElements } from "./repertoireText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface RepertoireViewOptions {
  readonly onReviewed: (drillReview: DrillReview) => void;
  readonly now: () => number;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
}

export interface RepertoireView {
  setData(routes: readonly OpeningRoute[], drills: readonly OpeningDrill[], hasGames: boolean): void;
}

interface Attempt {
  readonly drill: OpeningDrill;
  isOver: boolean;
  hasFailed: boolean;
  isThinking: boolean;
  solvedUci: string;
}

interface Trainer {
  readonly options: RepertoireViewOptions;
  readonly elements: RepertoireElements;
  readonly board: BoardView;
  readonly explore: ExploreView;
  drills: readonly OpeningDrill[];
  focus: OpeningFocus | null;
  queue: OpeningDrill[];
  current: Attempt | null;
  timers: number[];
}

/** Un mauvais coup reste ce temps sur le plateau avant que la pièce revienne, comme dans les problèmes. */
const WRONG_MOVE_MS = 700;

function showPosition(trainer: Trainer, attempt: Attempt): void {
  trainer.board.show({
    fen: attempt.drill.fen,
    orientation: attempt.drill.playerColor,
    lastMoveUci: attempt.drill.previousMoveUci,
    hintSquare: null,
    isInteractive: !attempt.isOver && !attempt.isThinking,
  });
}

function clearTimers(trainer: Trainer): void {
  trainer.timers.forEach((timer) => {
    window.clearTimeout(timer);
  });
  trainer.timers = [];
}

function renderCounts(trainer: Trainer): void {
  const isSolving = trainer.current !== null && !trainer.current.isOver;
  setText(trainer.elements.counts, describeRepertoireCounts(trainer.drills, trainer.queue.length + (isSolving ? 1 : 0)));
}

function setSolving(elements: RepertoireElements, attempt: Attempt): void {
  elements.reveal.hidden = attempt.isOver;
  elements.next.hidden = !attempt.isOver;
  elements.debrief.hidden = !attempt.isOver;
}

function finish(trainer: Trainer, attempt: Attempt, uci: string, isFound: boolean): void {
  const { elements, options } = trainer;
  const { drill } = attempt;
  clearTimers(trainer);
  attempt.isOver = true;
  attempt.solvedUci = uci;
  const review = applyReview(drill.review, attempt.hasFailed ? "failed" : "solved", options.now());
  trainer.drills = trainer.drills.map((candidate) => (candidate.id === drill.id ? { ...candidate, review } : candidate));
  options.onReviewed({ id: drill.id, username: drill.username, review });
  const hasOtherBest = drill.bestUci !== uci;
  trainer.board.show({
    fen: playUci(drill.fen, uci)?.fen ?? drill.fen,
    orientation: drill.playerColor,
    lastMoveUci: uci,
    hintSquare: null,
    isInteractive: false,
    arrows: hasOtherBest ? [{ uci: drill.bestUci, tone: "best" }] : [],
    marks: isFound ? [{ square: uci.slice(2, 4), tone: "success" }] : [],
  });
  setText(elements.prompt, isFound ? "Vous restez sur la route." : "Le bon coup :");
  setText(elements.played, `${describeExit(drill)}.`);
  setText(elements.schedule, `Cette position reviendra ${describeDelay(review.dueAt, options.now())}.`);
  elements.link.href = drill.gameUrl;
  trainer.explore.open({ fen: drill.fen, playerColor: drill.playerColor, solutionLine: lineToSan(drill.fen, [drill.bestUci]), playedSan: drill.playedSans[0] ?? null });
  setSolving(elements, attempt);
  elements.next.focus();
  renderCounts(trainer);
}

function rejectMove(trainer: Trainer, attempt: Attempt, uci: string, text: string): void {
  attempt.hasFailed = true;
  trainer.options.sound.play("error");
  setText(trainer.elements.feedback, text);
  trainer.board.show({
    fen: playUci(attempt.drill.fen, uci)?.fen ?? attempt.drill.fen,
    orientation: attempt.drill.playerColor,
    lastMoveUci: null,
    hintSquare: null,
    isInteractive: false,
    marks: [
      { square: uci.slice(0, 2), tone: "error" },
      { square: uci.slice(2, 4), tone: "error" },
    ],
  });
  trainer.board.shake();
  trainer.timers.push(
    window.setTimeout(() => {
      showPosition(trainer, attempt);
    }, WRONG_MOVE_MS),
  );
}

async function playMove(trainer: Trainer, attempt: Attempt, uci: string): Promise<void> {
  attempt.isThinking = true;
  setText(trainer.elements.feedback, "Le moteur vérifie votre coup…");
  showPosition(trainer, attempt);
  try {
    const verdict = await judgeOpeningMove(trainer.options.engine, attempt.drill, uci);
    attempt.isThinking = false;
    if (trainer.current !== attempt || attempt.isOver) {
      return;
    }
    if (!verdict.isAccepted) {
      rejectMove(trainer, attempt, uci, verdict.text);
      return;
    }
    trainer.options.sound.play(playUci(attempt.drill.fen, uci)?.sound ?? "move");
    trainer.options.sound.play("success", 180);
    setText(trainer.elements.feedback, verdict.text);
    finish(trainer, attempt, uci, true);
  } catch {
    attempt.isThinking = false;
    setText(trainer.elements.feedback, "Le moteur n'a pas pu démarrer : seul son coup peut être vérifié. Essayez « Voir le bon coup ».");
    showPosition(trainer, attempt);
  }
}

function handleMove(trainer: Trainer, uci: string): void {
  if (trainer.explore.handleMove(uci)) {
    return;
  }
  const attempt = trainer.current;
  if (attempt !== null && !attempt.isOver && !attempt.isThinking) {
    void playMove(trainer, attempt, uci);
  }
}

function reveal(trainer: Trainer): void {
  const attempt = trainer.current;
  if (attempt === null || attempt.isThinking || attempt.isOver) {
    return;
  }
  attempt.hasFailed = true;
  const bestName = playUci(attempt.drill.fen, attempt.drill.bestUci)?.san ?? attempt.drill.bestUci;
  setText(trainer.elements.feedback, `Le coup du moteur : ${frenchSan(bestName)}, joué sur le plateau.`);
  finish(trainer, attempt, attempt.drill.bestUci, false);
}

function showNext(trainer: Trainer): void {
  const { elements, options } = trainer;
  const drill = trainer.queue.shift() ?? null;
  clearTimers(trainer);
  trainer.explore.close();
  trainer.current = drill === null ? null : { drill, isOver: false, hasFailed: false, isThinking: false, solvedUci: "" };
  elements.trainer.hidden = drill === null;
  elements.empty.hidden = drill !== null;
  setText(elements.empty, describeRepertoireEmpty(trainer.drills, options.now()));
  renderCounts(trainer);
  if (trainer.current === null || drill === null) {
    return;
  }
  setText(elements.prompt, `${drill.openingName} : jouez le bon coup.`);
  setText(elements.origin, `Coup ${drill.moveNumber}, position de votre partie ${TIME_CLASS_NAMES[drill.timeClass]} du ${formatDay(drill.gameEndTime * 1000)}.`);
  setText(elements.feedback, "");
  setSolving(elements, trainer.current);
  showPosition(trainer, trainer.current);
}

function refill(trainer: Trainer, keepCurrent: boolean): void {
  const shownId = keepCurrent ? trainer.current?.drill.id : undefined;
  trainer.queue = selectOpeningSession(trainer.drills, trainer.options.now(), trainer.focus).filter((drill) => drill.id !== shownId);
  if (keepCurrent && trainer.drills.some((drill) => drill.id === shownId)) {
    renderCounts(trainer);
    return;
  }
  showNext(trainer);
}

function setFocus(trainer: Trainer, focus: OpeningFocus | null): void {
  trainer.focus = focus;
  const count = trainer.drills.filter((drill) => drill.openingName === focus?.openingName && drill.playerColor === focus.playerColor).length;
  trainer.elements.filter.hidden = focus === null;
  setText(trainer.elements.filterText, focus === null ? "" : describeFocus(focus, count));
  refill(trainer, false);
  trainer.elements.section.scrollIntoView({ block: "start" });
  trainer.elements.prompt.tabIndex = -1;
  trainer.elements.prompt.focus();
}

function attachControls(trainer: Trainer): void {
  const actions: Readonly<Record<string, () => void>> = {
    "repertoire-reveal": () => {
      reveal(trainer);
    },
    "repertoire-next": () => {
      showNext(trainer);
    },
    "repertoire-clear": () => {
      setFocus(trainer, null);
    },
    "repertoire-explore-continue": () => {
      trainer.explore.continueWith(trainer.current?.solvedUci ?? "");
    },
    "repertoire-explore-game": () => {
      trainer.explore.showGameMove();
    },
    "repertoire-explore-reset": () => {
      trainer.explore.reset();
    },
  };
  Object.entries(actions).forEach(([id, action]) => {
    requireElement(id, HTMLButtonElement).addEventListener("click", action);
  });
}

/** « Votre répertoire » : rejouer le bon coup là où l'on quitte la route dans ses ouvertures. */
export function createRepertoireView(options: RepertoireViewOptions): RepertoireView {
  const elements = collectRepertoireElements();
  const promotionDialog = requireElement("promotion", HTMLDialogElement);
  const board = createBoard({
    root: requireElement("repertoire-board", HTMLElement),
    onMove: (uci) => {
      handleMove(trainer, uci);
    },
    choosePromotion: () => askPromotion(promotionDialog),
  });
  const explore = createExploreView({ board, sound: options.sound, engine: options.engine, prefix: "repertoire-explore", root: elements.trainer });
  const trainer: Trainer = { options, elements, board, explore, drills: [], focus: null, queue: [], current: null, timers: [] };
  attachControls(trainer);
  return {
    setData: (routes, drills, hasGames) => {
      elements.section.hidden = !hasGames;
      elements.routes.hidden = routes.length === 0;
      elements.routesList.replaceChildren(...routes.map((route) => routeItem(route, (focus) => {
        setFocus(trainer, focus);
      })));
      trainer.drills = drills;
      refill(trainer, true);
    },
  };
}
