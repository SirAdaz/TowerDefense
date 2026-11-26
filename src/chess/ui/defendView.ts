import { requireElement, setText } from "../../shared/dom.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { lineToSan } from "../game/analysis.ts";
import { frenchSan } from "../game/notation.ts";
import { applyReview, selectSession } from "../game/schedule.ts";
import { describeThreat, isThreatSquare } from "../game/threats.ts";
import type { DefenseDrill, DrillReview } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardView, SquareMark } from "./board.ts";
import type { BoardArrow } from "./boardOverlay.ts";
import { judgeParry } from "./defendParry.ts";
import {
  PARRY_HELP,
  PARRY_PROMPT,
  SPOT_HELP,
  SPOT_PROMPT,
  collectDefendElements,
  describeDefendCounts,
  describeDefendEmpty,
  describeWrongSquare,
} from "./defendText.ts";
import type { DefendElements } from "./defendText.ts";
import { createExploreView } from "./exploreView.ts";
import type { ExploreView } from "./exploreView.ts";
import { TIME_CLASS_NAMES, describeDelay, formatDay } from "./format.ts";
import { askPromotion, playUci } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface DefendViewOptions {
  readonly onReviewed: (drillReview: DrillReview) => void;
  readonly now: () => number;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
}

export interface DefendView {
  setDrills(drills: readonly DefenseDrill[], hasGames: boolean): void;
}

/** `spot` : désigner la menace ; `parry` : jouer la parade ; `over` : correction affichée. */
type Phase = "spot" | "parry" | "over";

interface Attempt {
  readonly drill: DefenseDrill;
  phase: Phase;
  hasFailed: boolean;
  isThinking: boolean;
  solvedUci: string;
}

interface Trainer {
  readonly options: DefendViewOptions;
  readonly elements: DefendElements;
  readonly board: BoardView;
  readonly explore: ExploreView;
  drills: readonly DefenseDrill[];
  queue: DefenseDrill[];
  current: Attempt | null;
  timers: number[];
}

/** Un mauvais coup reste ce temps sur le plateau avant que la pièce revienne, comme dans les problèmes. */
const WRONG_MOVE_MS = 700;

function threatArrow(drill: DefenseDrill): BoardArrow {
  return { uci: drill.threat.moveUci, tone: "played" };
}

function showPosition(trainer: Trainer, attempt: Attempt, marks: readonly SquareMark[] = []): void {
  const isParry = attempt.phase === "parry";
  trainer.board.show({
    fen: attempt.drill.fen,
    orientation: attempt.drill.playerColor,
    lastMoveUci: attempt.drill.previousMoveUci,
    hintSquare: null,
    isInteractive: isParry && !attempt.isThinking,
    isPickingSquare: attempt.phase === "spot",
    arrows: isParry ? [threatArrow(attempt.drill)] : [],
    marks,
  });
  setText(trainer.elements.boardHelp, attempt.phase === "spot" ? SPOT_HELP : PARRY_HELP);
}

function clearTimers(trainer: Trainer): void {
  trainer.timers.forEach((timer) => {
    window.clearTimeout(timer);
  });
  trainer.timers = [];
}

function renderCounts(trainer: Trainer): void {
  const isSolving = trainer.current !== null && trainer.current.phase !== "over";
  setText(trainer.elements.counts, describeDefendCounts(trainer.drills, trainer.queue.length + (isSolving ? 1 : 0)));
}

function setSolving(elements: DefendElements, attempt: Attempt): void {
  const isOver = attempt.phase === "over";
  elements.reveal.hidden = isOver;
  setText(elements.reveal, attempt.phase === "spot" ? "Voir la menace" : "Voir une parade");
  elements.next.hidden = !isOver;
  elements.debrief.hidden = !isOver;
}

/** Menace trouvée (ou montrée) : elle reste en flèche rouge, place à la parade. */
function startParry(trainer: Trainer, attempt: Attempt, text: string): void {
  attempt.phase = "parry";
  setText(trainer.elements.prompt, PARRY_PROMPT);
  setText(trainer.elements.feedback, text);
  setSolving(trainer.elements, attempt);
  showPosition(trainer, attempt, [{ square: attempt.drill.threat.to, tone: "error" }]);
}

function pickSquare(trainer: Trainer, square: string): void {
  const attempt = trainer.current;
  if (attempt === null || attempt.phase !== "spot") {
    return;
  }
  if (!isThreatSquare(attempt.drill.threat, square)) {
    attempt.hasFailed = true;
    trainer.options.sound.play("error");
    setText(trainer.elements.feedback, describeWrongSquare(square));
    showPosition(trainer, attempt, [{ square, tone: "error" }]);
    return;
  }
  trainer.options.sound.play("success");
  startParry(trainer, attempt, `Oui. ${describeThreat(attempt.drill.fen, attempt.drill.threat)}`);
}

function finish(trainer: Trainer, attempt: Attempt, uci: string, isFound: boolean): void {
  const { elements, options } = trainer;
  const { drill } = attempt;
  clearTimers(trainer);
  attempt.phase = "over";
  attempt.solvedUci = uci;
  const review = applyReview(drill.review, attempt.hasFailed ? "failed" : "solved", options.now());
  trainer.drills = trainer.drills.map((candidate) => (candidate.id === drill.id ? { ...candidate, review } : candidate));
  options.onReviewed({ id: drill.id, username: drill.username, review });
  const hasOtherBest = drill.bestUci !== "" && drill.bestUci !== uci;
  trainer.board.show({
    fen: playUci(drill.fen, uci)?.fen ?? drill.fen,
    orientation: drill.playerColor,
    lastMoveUci: uci,
    hintSquare: null,
    isInteractive: false,
    arrows: hasOtherBest ? [{ uci: drill.bestUci, tone: "best" }] : [],
    marks: isFound ? [{ square: uci.slice(2, 4), tone: "success" }] : [],
  });
  setText(elements.prompt, isFound ? "Menace parée." : "Une parade possible :");
  setText(elements.played, `Dans la partie, vous aviez joué ${frenchSan(drill.playedSan)}, qui laissait ${frenchSan(drill.threat.san)}.`);
  setText(elements.schedule, `Ce problème reviendra ${describeDelay(review.dueAt, options.now())}.`);
  elements.link.href = drill.gameUrl;
  trainer.explore.open({ fen: drill.fen, playerColor: drill.playerColor, solutionLine: lineToSan(drill.fen, [drill.bestUci]), playedSan: drill.playedSan });
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

async function playParry(trainer: Trainer, attempt: Attempt, uci: string): Promise<void> {
  attempt.isThinking = true;
  setText(trainer.elements.feedback, "Le moteur vérifie votre coup…");
  showPosition(trainer, attempt);
  try {
    const verdict = await judgeParry(trainer.options.engine, attempt.drill, uci);
    attempt.isThinking = false;
    if (trainer.current !== attempt || attempt.phase !== "parry") {
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
    setText(trainer.elements.feedback, "Le moteur n'a pas pu démarrer : seul son coup peut être vérifié. Essayez « Voir une parade ».");
    showPosition(trainer, attempt);
  }
}

function handleMove(trainer: Trainer, uci: string): void {
  if (trainer.explore.handleMove(uci)) {
    return;
  }
  const attempt = trainer.current;
  if (attempt !== null && attempt.phase === "parry" && !attempt.isThinking) {
    void playParry(trainer, attempt, uci);
  }
}

function reveal(trainer: Trainer): void {
  const attempt = trainer.current;
  if (attempt === null || attempt.isThinking) {
    return;
  }
  attempt.hasFailed = true;
  if (attempt.phase === "spot") {
    startParry(trainer, attempt, `Voici la menace. ${describeThreat(attempt.drill.fen, attempt.drill.threat)}`);
    return;
  }
  const bestUci = attempt.drill.bestUci;
  if (attempt.phase === "parry" && bestUci !== "") {
    const bestName = playUci(attempt.drill.fen, bestUci)?.san ?? bestUci;
    setText(trainer.elements.feedback, `Une parade : ${bestName}, le coup du moteur, en flèche.`);
    finish(trainer, attempt, bestUci, false);
  }
}

function showNext(trainer: Trainer): void {
  const { elements, options } = trainer;
  const drill = trainer.queue.shift() ?? null;
  clearTimers(trainer);
  trainer.explore.close();
  trainer.current = drill === null ? null : { drill, phase: "spot", hasFailed: false, isThinking: false, solvedUci: "" };
  elements.trainer.hidden = drill === null;
  elements.empty.hidden = drill !== null;
  setText(elements.empty, describeDefendEmpty(trainer.drills, options.now()));
  renderCounts(trainer);
  if (trainer.current === null || drill === null) {
    return;
  }
  setText(elements.prompt, SPOT_PROMPT);
  setText(elements.origin, `Position tirée de votre partie ${TIME_CLASS_NAMES[drill.timeClass]} du ${formatDay(drill.gameEndTime * 1000)}. C'est à vous de jouer.`);
  setText(elements.feedback, "");
  setSolving(elements, trainer.current);
  showPosition(trainer, trainer.current);
}

function attachControls(trainer: Trainer): void {
  const actions: Readonly<Record<string, () => void>> = {
    "defend-reveal": () => {
      reveal(trainer);
    },
    "defend-next": () => {
      showNext(trainer);
    },
    "defend-explore-continue": () => {
      trainer.explore.continueWith(trainer.current?.solvedUci ?? "");
    },
    "defend-explore-game": () => {
      trainer.explore.showGameMove();
    },
    "defend-explore-reset": () => {
      trainer.explore.reset();
    },
  };
  Object.entries(actions).forEach(([id, action]) => {
    requireElement(id, HTMLButtonElement).addEventListener("click", action);
  });
}

/** « Voir la menace » : désigner ce que l'adversaire menace, puis le parer. */
export function createDefendView(options: DefendViewOptions): DefendView {
  const elements = collectDefendElements();
  const promotionDialog = requireElement("promotion", HTMLDialogElement);
  const board = createBoard({
    root: requireElement("defend-board", HTMLElement),
    onMove: (uci) => {
      handleMove(trainer, uci);
    },
    onSquare: (square) => {
      pickSquare(trainer, square);
    },
    choosePromotion: () => askPromotion(promotionDialog),
  });
  const explore = createExploreView({ board, sound: options.sound, engine: options.engine, prefix: "defend-explore", root: elements.trainer });
  const trainer: Trainer = { options, elements, board, explore, drills: [], queue: [], current: null, timers: [] };
  attachControls(trainer);
  return {
    setDrills: (drills, hasGames) => {
      elements.section.hidden = !hasGames;
      const shownId = trainer.current?.drill.id;
      trainer.drills = drills;
      trainer.queue = selectSession(drills, options.now()).filter((drill) => drill.id !== shownId);
      if (!drills.some((drill) => drill.id === shownId)) {
        showNext(trainer);
      } else {
        renderCounts(trainer);
      }
    },
  };
}
