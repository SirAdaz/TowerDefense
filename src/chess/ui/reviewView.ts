import { requireElement, setText } from "../../shared/dom.ts";
import { ChessComError, isAbortError } from "../data/chesscomApi.ts";
import type { Engine } from "../data/engine.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { rebuildTimeline } from "../data/gameTimeline.ts";
import type { ChessStore } from "../data/store.ts";
import { buildGameReview } from "../game/gameReview.ts";
import type { GameReviewData, PlyReview } from "../game/gameReview.ts";
import type { AnalysedGame, GameTimeline } from "../game/types.ts";
import { createBoard } from "./board.ts";
import type { BoardPosition, BoardView } from "./board.ts";
import { createExploreView, isKeyForZone } from "./exploreView.ts";
import type { ExploreView } from "./exploreView.ts";
import { describeGameTitle, renderGameList } from "./gameList.ts";
import { askPromotion, playUci } from "./puzzleText.ts";
import { describeTime, indexFromPointer, renderEvalChart, renderTimeChart } from "./reviewCharts.ts";
import { collectReviewElements } from "./reviewElements.ts";
import type { ReviewElements } from "./reviewElements.ts";
import { describePly, markCurrentMove, renderMoveList, renderSummary, whiteShare } from "./reviewMoves.ts";
import type { SoundPlayer } from "./sound.ts";
import { FAILURE_MESSAGES, TEXTS } from "./texts.ts";

export interface ReviewViewOptions {
  readonly store: ChessStore;
  readonly startEngine: () => Promise<Engine>;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
  /** Une partie a gagné sa revue (analyse refaite) : la liste et le bilan se relisent. */
  readonly onGameUpdated: () => void;
}

export interface ReviewView {
  setGames(games: readonly AnalysedGame[]): void;
}

interface Reviewer {
  readonly options: ReviewViewOptions;
  readonly elements: ReviewElements;
  readonly board: BoardView;
  readonly explore: ExploreView;
  game: AnalysedGame | null;
  review: GameReviewData | null;
  /** Position affichée : 0 = départ, n = après le n-ième demi-coup. */
  index: number;
  abortController: AbortController | null;
}

const KEY_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, Home: -9999, End: 9999 };

function currentPly(reviewer: Reviewer): PlyReview | null {
  return reviewer.review?.plies[reviewer.index - 1] ?? null;
}

function fenAtIndex(review: GameReviewData, index: number): string {
  return review.plies[index]?.fenBefore ?? review.finalFen;
}

/** Position affichée : le coup joué surligné, son avis en coin de case, la flèche du moteur s'il voyait mieux. */
function showBoard(reviewer: Reviewer, review: GameReviewData, game: AnalysedGame, ply: PlyReview | null): void {
  const hasBetterMove = ply !== null && ply.bestUci !== "" && ply.bestUci !== ply.uci;
  const position: BoardPosition = {
    fen: fenAtIndex(review, reviewer.index),
    orientation: game.playerColor,
    lastMoveUci: ply === null ? null : ply.uci,
    hintSquare: null,
    isInteractive: true,
    arrows: hasBetterMove ? [{ uci: ply.bestUci, tone: "best" }] : [],
  };
  reviewer.board.show(ply === null ? position : { ...position, badge: { square: ply.uci.slice(2, 4), moveClass: ply.moveClass } });
}

function setNavigation(elements: ReviewElements, index: number, plyCount: number): void {
  elements.first.disabled = index === 0;
  elements.prev.disabled = index === 0;
  elements.next.disabled = index >= plyCount;
  elements.last.disabled = index >= plyCount;
}

function renderPosition(reviewer: Reviewer): void {
  const { review, game, elements, index } = reviewer;
  if (review === null || game === null) {
    return;
  }
  const ply = currentPly(reviewer);
  showBoard(reviewer, review, game, ply);
  const whiteWin = ply === null ? review.whiteWinStart : ply.whiteWinAfter;
  const ownShare = game.playerColor === "white" ? whiteShare(whiteWin) : 100 - whiteShare(whiteWin);
  elements.evalFill.style.height = `${ownShare}%`;
  elements.evalFill.classList.toggle("is-black", game.playerColor === "black");
  setText(elements.comment, describePly(ply, game.playerColor, review.whiteWinStart));
  setNavigation(elements, index, review.plies.length);
  markCurrentMove(elements.moves, index);
  renderEvalChart(elements.evalChart, review, index);
  renderTimeChart(elements.timeChart, review, index);
}

function goTo(reviewer: Reviewer, index: number): void {
  const review = reviewer.review;
  if (review === null) {
    return;
  }
  const target = Math.max(0, Math.min(review.plies.length, index));
  const arriving = review.plies[target - 1];
  if (target === reviewer.index + 1 && arriving !== undefined) {
    reviewer.options.sound.play(playUci(arriving.fenBefore, arriving.uci)?.sound ?? "move");
  }
  leaveExplore(reviewer);
  reviewer.index = target;
  renderPosition(reviewer);
}

function leaveExplore(reviewer: Reviewer): void {
  reviewer.explore.close();
  reviewer.elements.exploreExit.hidden = true;
  reviewer.elements.explore.hidden = false;
}

/** Explorer depuis la position affichée : on y joue librement, le moteur répond. */
function enterExplore(reviewer: Reviewer): void {
  const { review, game } = reviewer;
  if (review === null || game === null) {
    return;
  }
  reviewer.explore.open({ fen: fenAtIndex(review, reviewer.index), playerColor: game.playerColor, solutionLine: [], playedSan: null });
  reviewer.explore.reset();
  reviewer.elements.explore.hidden = true;
  reviewer.elements.exploreExit.hidden = false;
}

function showReview(reviewer: Reviewer, timeline: GameTimeline): void {
  const { elements } = reviewer;
  const review = buildGameReview(timeline);
  reviewer.review = review;
  elements.body.hidden = review === null;
  if (review === null) {
    setText(elements.status, "Cette partie ne peut pas être relue (PGN illisible).");
    return;
  }
  setText(elements.whiteName, `${review.whiteName} (blancs)`);
  setText(elements.blackName, `${review.blackName} (noirs)`);
  renderSummary(elements.summary, review);
  renderMoveList(elements.moves, review, (index) => {
    goTo(reviewer, index);
  });
  setText(elements.timeText, describeTime(review));
  elements.timeChart.toggleAttribute("hidden", review.plies.every((ply) => ply.spentSeconds === null));
  reviewer.index = 0;
  leaveExplore(reviewer);
  renderPosition(reviewer);
}

function describeLoadFailure(error: unknown): string {
  if (isAbortError(error)) {
    return "Analyse annulée.";
  }
  if (error instanceof ChessComError) {
    return error.reason === "not-found" ? "Chess.com ne retrouve plus cette partie : elle ne peut pas être revue." : FAILURE_MESSAGES[error.reason];
  }
  console.error("Revue impossible", error);
  return TEXTS.engineFailed;
}

/** Partie analysée avant la revue : on la relit et la réévalue, barre de progression à l'appui. */
async function loadTimeline(reviewer: Reviewer, game: AnalysedGame): Promise<GameTimeline | null> {
  const { elements, options } = reviewer;
  const controller = new AbortController();
  reviewer.abortController = controller;
  elements.progress.hidden = false;
  elements.progressBar.value = 0;
  setText(elements.progressLabel, "Lecture de la partie sur chess.com…");
  try {
    return await rebuildTimeline(game, {
      store: options.store,
      startEngine: options.startEngine,
      signal: controller.signal,
      onProgress: (done, total) => {
        elements.progressBar.value = done / total;
        setText(elements.progressLabel, `Analyse de la partie : position ${done} sur ${total}`);
      },
    });
  } catch (error) {
    setText(elements.status, describeLoadFailure(error));
    return null;
  } finally {
    reviewer.abortController = null;
    elements.progress.hidden = true;
  }
}

async function openGame(reviewer: Reviewer, game: AnalysedGame): Promise<void> {
  const { elements } = reviewer;
  reviewer.game = game;
  reviewer.review = null;
  elements.picker.hidden = true;
  elements.review.hidden = false;
  elements.body.hidden = true;
  setText(elements.title, describeGameTitle(game));
  setText(elements.status, "");
  elements.back.focus();
  const timeline = game.timeline ?? (await loadTimeline(reviewer, game));
  if (timeline !== null && reviewer.game === game) {
    if (game.timeline === undefined) {
      reviewer.game = { ...game, timeline };
      setText(elements.title, describeGameTitle(reviewer.game));
      reviewer.options.onGameUpdated();
    }
    showReview(reviewer, timeline);
  }
}

function closeGame(reviewer: Reviewer): void {
  reviewer.abortController?.abort();
  leaveExplore(reviewer);
  reviewer.game = null;
  reviewer.review = null;
  reviewer.elements.review.hidden = true;
  reviewer.elements.picker.hidden = false;
  reviewer.elements.list.querySelector<HTMLButtonElement>("button")?.focus();
}

function attachControls(reviewer: Reviewer): void {
  const { elements } = reviewer;
  const steps: readonly [HTMLButtonElement, () => number][] = [
    [elements.first, () => 0],
    [elements.prev, () => reviewer.index - 1],
    [elements.next, () => reviewer.index + 1],
    [elements.last, () => reviewer.review?.plies.length ?? 0],
  ];
  steps.forEach(([button, target]) => {
    button.addEventListener("click", () => {
      goTo(reviewer, target());
    });
  });
  for (const chart of [elements.evalChart, elements.timeChart]) {
    chart.addEventListener("click", (event) => {
      goTo(reviewer, indexFromPointer(chart, event.clientX, reviewer.review?.plies.length ?? 0));
    });
  }
  elements.back.addEventListener("click", () => {
    closeGame(reviewer);
  });
  elements.cancel.addEventListener("click", () => {
    reviewer.abortController?.abort();
  });
  elements.explore.addEventListener("click", () => {
    enterExplore(reviewer);
  });
  elements.exploreExit.addEventListener("click", () => {
    goTo(reviewer, reviewer.index);
    elements.explore.focus();
  });
  document.addEventListener("keydown", (event) => {
    const delta = KEY_STEPS[event.key];
    if (delta === undefined || reviewer.review === null || reviewer.explore.isActive() || !isKeyForZone(event, elements.review)) {
      return;
    }
    event.preventDefault();
    goTo(reviewer, reviewer.index + delta);
  });
}

/** Revue de partie coup par coup : avis sur chaque coup des deux camps, courbe, temps, exploration. */
export function createReviewView(options: ReviewViewOptions): ReviewView {
  const elements = collectReviewElements();
  const promotionDialog = requireElement("promotion", HTMLDialogElement);
  const board = createBoard({
    root: requireElement("review-board", HTMLElement),
    onMove: (uci) => {
      if (!reviewer.explore.isActive()) {
        enterExplore(reviewer);
      }
      reviewer.explore.handleMove(uci);
    },
    choosePromotion: () => askPromotion(promotionDialog),
  });
  const explore = createExploreView({ board, sound: options.sound, engine: options.engine, prefix: "review-explore", root: elements.review });
  const reviewer: Reviewer = { options, elements, board, explore, game: null, review: null, index: 0, abortController: null };
  attachControls(reviewer);
  return {
    setGames: (games) => {
      const reviewable = games.filter((game) => game.moves.length > 0);
      elements.section.hidden = reviewable.length === 0;
      renderGameList(elements.list, reviewable, (game) => {
        void openGame(reviewer, game);
      });
    },
  };
}
