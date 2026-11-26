import { requireElement, setText } from "../../shared/dom.ts";
import type { KeyValueStore } from "../../shared/storage.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { winPercent } from "../game/evaluation.ts";
import { formatPawnsSigned } from "../game/explore.ts";
import { frenchSan } from "../game/notation.ts";
import { OPPONENT_LEVELS, levelById, loadLevel, saveLevel } from "../game/opponent.ts";
import type { OpponentLevel } from "../game/opponent.ts";
import { applyReview, selectSession } from "../game/schedule.ts";
import type { ConversionDrill, DrillReview } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardView } from "./board.ts";
import { playPlayerMove, showGame, showHint } from "./convertPlay.ts";
import type { ConvertGame, Mistake, PlayContext } from "./convertPlay.ts";
import { collectConvertElements, describeConvertCounts, describeConvertEmpty, describeEnd, describePrompt } from "./convertText.ts";
import type { ConvertElements, ConvertEnd } from "./convertText.ts";
import { createExploreView } from "./exploreView.ts";
import type { ExploreView } from "./exploreView.ts";
import { TIME_CLASS_NAMES, describeDelay, formatDay } from "./format.ts";
import { askPromotion } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface ConvertViewOptions {
  /** Garde le nouvel état de révision d'un exercice. */
  readonly onReviewed: (drillReview: DrillReview) => void;
  readonly now: () => number;
  readonly random: () => number;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
  readonly keyValueStore: KeyValueStore;
}

export interface ConvertView {
  /** Exercices à jour ; `hasGames` : le joueur a des parties analysées (sinon la section reste cachée). */
  setDrills(drills: readonly ConversionDrill[], hasGames: boolean): void;
}

interface Trainer {
  readonly options: ConvertViewOptions;
  readonly elements: ConvertElements;
  readonly board: BoardView;
  readonly explore: ExploreView;
  drills: readonly ConversionDrill[];
  queue: ConversionDrill[];
  current: ConvertGame | null;
  level: OpponentLevel;
  requestId: number;
}

const WON_ENDS: ReadonlySet<ConvertEnd> = new Set(["mate", "resigned", "held"]);

function renderCounts(trainer: Trainer): void {
  const isPlaying = trainer.current !== null && !trainer.current.isOver;
  setText(trainer.elements.counts, describeConvertCounts(trainer.drills, trainer.queue.length + (isPlaying ? 1 : 0)));
}

function setPlayingControls(elements: ConvertElements, isPlaying: boolean): void {
  elements.hint.hidden = !isPlaying;
  elements.resign.hidden = !isPlaying;
  elements.next.hidden = isPlaying;
  elements.debrief.hidden = isPlaying;
}

/** Fin de l'exercice : le coup fautif en rouge et le meilleur en vert (s'il y en a un), le résultat gardé. */
function showMistake(trainer: Trainer, game: ConvertGame, mistake: Mistake): void {
  trainer.board.show({
    fen: mistake.fenBefore,
    orientation: game.drill.playerColor,
    lastMoveUci: null,
    hintSquare: null,
    isInteractive: false,
    arrows: [{ uci: mistake.uci, tone: "played" }],
  });
  void trainer.options.engine
    .bestLine(mistake.fenBefore)
    .then((best) => {
      if (best !== null && trainer.current === game && !trainer.explore.isActive()) {
        trainer.board.setArrows([
          { uci: mistake.uci, tone: "played" },
          { uci: best.moveUci, tone: "best" },
        ]);
      }
    })
    .catch(() => undefined);
}

function finish(trainer: Trainer, game: ConvertGame, end: ConvertEnd, mistake: Mistake | null): void {
  const { elements, options } = trainer;
  const isWon = WON_ENDS.has(end);
  trainer.requestId += 1;
  game.isOver = true;
  game.isThinking = false;
  const outcome = isWon ? (game.hasHint ? "hinted" : "solved") : "failed";
  const review = applyReview(game.drill.review, outcome, options.now());
  trainer.drills = trainer.drills.map((drill) => (drill.id === game.drill.id ? { ...drill, review } : drill));
  options.onReviewed({ id: game.drill.id, username: game.drill.username, review });
  options.sound.play(isWon ? "success" : "error", 180);
  if (mistake === null) {
    showGame(contextOf(trainer), game);
  } else {
    showMistake(trainer, game, mistake);
  }
  setText(elements.feedback, describeEnd(end));
  setText(elements.played, `Dans la partie, vous aviez joué ${frenchSan(game.drill.playedSan)} depuis cette position.`);
  setText(elements.schedule, `Cet exercice reviendra ${describeDelay(review.dueAt, options.now())}.`);
  elements.link.href = game.drill.gameUrl;
  trainer.explore.open({ fen: game.drill.fen, playerColor: game.drill.playerColor, solutionLine: [], playedSan: game.drill.playedSan });
  setPlayingControls(elements, false);
  elements.next.focus();
  renderCounts(trainer);
}

function contextOf(trainer: Trainer): PlayContext {
  return {
    elements: trainer.elements,
    board: trainer.board,
    engine: trainer.options.engine,
    sound: trainer.options.sound,
    random: trainer.options.random,
    level: () => trainer.level,
    nextRequest: () => {
      trainer.requestId += 1;
      return trainer.requestId;
    },
    isCurrent: (requestId) => requestId === trainer.requestId,
    finish: (game, end, mistake) => {
      finish(trainer, game, end, mistake);
    },
    engineDown: (game) => {
      game.isOver = true;
      setText(trainer.elements.evaluation, "Le moteur n'a pas pu démarrer : cet exercice ne peut pas être joué ici. Rechargez la page.");
      setPlayingControls(trainer.elements, false);
      trainer.elements.debrief.hidden = true;
      showGame(contextOf(trainer), game);
    },
  };
}

function showNext(trainer: Trainer): void {
  const { elements, options } = trainer;
  const drill = trainer.queue.shift() ?? null;
  trainer.requestId += 1;
  trainer.explore.close();
  trainer.current = drill === null ? null : { drill, moves: [], playerMoves: 0, hasHint: false, isOver: false, isThinking: false };
  elements.trainer.hidden = drill === null;
  elements.empty.hidden = drill !== null;
  setText(elements.empty, describeConvertEmpty(trainer.drills, options.now()));
  renderCounts(trainer);
  if (trainer.current === null || drill === null) {
    return;
  }
  setText(elements.prompt, describePrompt(drill));
  setText(elements.origin, `Position tirée de votre partie ${TIME_CLASS_NAMES[drill.timeClass]} du ${formatDay(drill.gameEndTime * 1000)}, juste avant une gaffe.`);
  setText(elements.feedback, "");
  setText(elements.evaluation, `Évaluation de départ : ${formatPawnsSigned(drill.startCp)}.`);
  elements.evalFill.style.width = `${winPercent(drill.startCp)}%`;
  setPlayingControls(elements, true);
  showGame(contextOf(trainer), trainer.current);
}

function handleMove(trainer: Trainer, uci: string): void {
  if (trainer.explore.handleMove(uci) || trainer.current === null) {
    return;
  }
  playPlayerMove(contextOf(trainer), trainer.current, uci);
}

function attachControls(trainer: Trainer): void {
  const { elements } = trainer;
  elements.hint.addEventListener("click", () => {
    const game = trainer.current;
    if (game === null) {
      return;
    }
    void showHint(contextOf(trainer), game)
      .then((san) => {
        if (san !== null) {
          setText(elements.feedback, `Indice : le moteur jouerait ${san}, en flèche verte. Réussi avec l'indice, l'exercice ne progresse pas.`);
        }
      })
      .catch(() => {
        setText(elements.feedback, "Le moteur n'a pas pu démarrer : pas d'indice.");
      });
  });
  elements.resign.addEventListener("click", () => {
    if (trainer.current !== null && !trainer.current.isOver) {
      finish(trainer, trainer.current, "gaveUp", null);
    }
  });
  elements.next.addEventListener("click", () => {
    showNext(trainer);
  });
  requireElement("convert-explore-game", HTMLButtonElement).addEventListener("click", () => {
    trainer.explore.showGameMove();
  });
  requireElement("convert-explore-reset", HTMLButtonElement).addEventListener("click", () => {
    trainer.explore.reset();
  });
}

function attachLevel(trainer: Trainer): void {
  const select = trainer.elements.level;
  select.replaceChildren(
    ...OPPONENT_LEVELS.map((level) => {
      const option = document.createElement("option");
      option.value = level.id;
      option.textContent = level.name;
      return option;
    }),
  );
  select.value = trainer.level.id;
  select.addEventListener("change", () => {
    trainer.level = levelById(select.value);
    saveLevel(trainer.options.keyValueStore, trainer.level.id);
  });
}

/** « Convertir un avantage » : rejouer contre le moteur les positions gagnantes gâchées par une gaffe. */
export function createConvertView(options: ConvertViewOptions): ConvertView {
  const elements = collectConvertElements();
  const promotionDialog = requireElement("promotion", HTMLDialogElement);
  const board = createBoard({
    root: requireElement("convert-board", HTMLElement),
    onMove: (uci) => {
      handleMove(trainer, uci);
    },
    choosePromotion: () => askPromotion(promotionDialog),
  });
  const explore = createExploreView({ board, sound: options.sound, engine: options.engine, prefix: "convert-explore", root: elements.trainer });
  const trainer: Trainer = {
    options,
    elements,
    board,
    explore,
    drills: [],
    queue: [],
    current: null,
    level: loadLevel(options.keyValueStore),
    requestId: 0,
  };
  attachControls(trainer);
  attachLevel(trainer);
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
