import { Chess } from "chess.js";
import { requireElement, setText } from "../../shared/dom.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import {
  createLine,
  describeEvaluation,
  fenAt,
  goTo,
  lastMoveOf,
  playMove,
  sanLineToUci,
  sideToMove,
  upcomingMove,
} from "../game/explore.ts";
import type { ExploreLine } from "../game/explore.ts";
import type { Puzzle } from "../game/types.ts";
import type { BoardView } from "./board.ts";
import type { BoardArrow } from "./boardOverlay.ts";
import { playUci } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface ExploreOptions {
  readonly board: BoardView;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
}

export interface ExploreView {
  /** Problème terminé : propose d'explorer, à partir du coup trouvé (ou de la solution). */
  open(puzzle: Puzzle, solvedUci: string): void;
  /** Problème suivant : l'exploration s'arrête. */
  close(): void;
  /** Coup joué sur le plateau ; faux si l'exploration n'est pas en cours (le problème le traite). */
  handleMove(uci: string): boolean;
}

/** Ce qui est exploré : `free` = on joue, le moteur répond ; `line` = suite du moteur ; `game` = coup de la partie. */
type ExploreMode = "free" | "line" | "game";

interface Elements {
  readonly panel: HTMLElement;
  readonly mode: HTMLElement;
  readonly step: HTMLElement;
  readonly evaluation: HTMLElement;
  readonly evalFill: HTMLElement;
  readonly prev: HTMLButtonElement;
  readonly next: HTMLButtonElement;
}

interface Explorer {
  readonly options: ExploreOptions;
  readonly elements: Elements;
  puzzle: Puzzle | null;
  solvedUci: string;
  mode: ExploreMode;
  line: ExploreLine | null;
  /** Numéro de la dernière demande au moteur : une réponse plus ancienne est ignorée. */
  requestId: number;
  /** Le moteur n'a pas démarré : on explore sans évaluation ni réponse. */
  isEngineDown: boolean;
}

const MODE_TEXTS: Readonly<Record<ExploreMode, string>> = {
  free: "Jouez vos coups : le moteur répond pour l'adversaire. La flèche montre son meilleur coup.",
  line: "Suite prévue par le moteur. Avancez coup par coup (boutons ou flèches du clavier).",
  game: "Votre coup de la partie, puis la réponse du moteur qui le punit.",
};

/** Longueur gardée de la réfutation : assez pour voir l'idée, sans dérouler toute une partie. */
const REFUTATION_PLIES = 8;

function collectElements(): Elements {
  return {
    panel: requireElement("explore-panel", HTMLElement),
    mode: requireElement("explore-mode", HTMLElement),
    step: requireElement("explore-step", HTMLElement),
    evaluation: requireElement("explore-eval", HTMLElement),
    evalFill: requireElement("explore-eval-fill", HTMLElement),
    prev: requireElement("explore-prev", HTMLButtonElement),
    next: requireElement("explore-next", HTMLButtonElement),
  };
}

function gameOverText(fen: string): string | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    return "Échec et mat.";
  }
  return chess.isGameOver() ? "Partie nulle." : null;
}

function describeStep(line: ExploreLine): string {
  const lastMove = lastMoveOf(line);
  if (lastMove === null) {
    return line.moves.length === 0 ? "Position de départ." : `Position de départ (0 sur ${line.moves.length}).`;
  }
  const san = playUci(fenAt(goTo(line, line.index - 1)), lastMove)?.san ?? lastMove;
  return `Coup ${line.index} sur ${line.moves.length} : ${san}.`;
}

function arrowTone(explorer: Explorer, line: ExploreLine): BoardArrow["tone"] {
  return explorer.mode === "game" && line.index === 0 ? "played" : "best";
}

function showLine(explorer: Explorer, line: ExploreLine, puzzle: Puzzle, isInteractive: boolean): void {
  const upcoming = upcomingMove(line);
  const arrows: BoardArrow[] = upcoming === null ? [] : [{ uci: upcoming, tone: arrowTone(explorer, line) }];
  explorer.options.board.show({
    fen: fenAt(line),
    orientation: puzzle.playerColor,
    lastMoveUci: lastMoveOf(line),
    hintSquare: null,
    isInteractive,
    arrows,
  });
  const { elements } = explorer;
  elements.panel.hidden = false;
  setText(elements.mode, MODE_TEXTS[explorer.mode]);
  setText(elements.step, describeStep(line));
  elements.prev.disabled = line.index === 0;
  elements.next.disabled = upcoming === null;
}

/** Montre la position de la suite, puis demande l'évaluation (et la réponse du moteur si `shouldReply`). */
function render(explorer: Explorer, shouldReply: boolean): void {
  const { line, puzzle, elements } = explorer;
  if (line === null || puzzle === null) {
    return;
  }
  const finished = gameOverText(fenAt(line));
  const isAsking = finished === null && !explorer.isEngineDown;
  showLine(explorer, line, puzzle, finished === null && !(shouldReply && isAsking));
  explorer.requestId += 1;
  if (!isAsking) {
    setText(elements.evaluation, finished ?? "Moteur indisponible : explorez sans évaluation.");
    return;
  }
  setText(elements.evaluation, shouldReply ? "Le moteur réfléchit…" : "Évaluation en cours…");
  void evaluate(explorer, explorer.requestId, shouldReply);
}

async function evaluate(explorer: Explorer, requestId: number, shouldReply: boolean): Promise<void> {
  const { line, puzzle, elements, options } = explorer;
  if (line === null || puzzle === null) {
    return;
  }
  const fen = fenAt(line);
  try {
    const best = await options.engine.bestLine(fen);
    if (requestId !== explorer.requestId || best === null) {
      return;
    }
    if (shouldReply) {
      playReply(explorer, best.moveUci);
      return;
    }
    const evaluation = describeEvaluation(best.score, sideToMove(fen) === puzzle.playerColor);
    setText(elements.evaluation, evaluation.text);
    elements.evalFill.style.width = `${evaluation.winPercent}%`;
    if (upcomingMove(line) === null) {
      options.board.setArrows([{ uci: best.moveUci, tone: "best" }]);
    }
  } catch {
    explorer.isEngineDown = true;
    if (requestId === explorer.requestId) {
      render(explorer, false);
    }
  }
}

function playReply(explorer: Explorer, uci: string): void {
  const line = explorer.line === null ? null : playMove(explorer.line, uci);
  if (line === null || explorer.line === null) {
    return;
  }
  explorer.options.sound.play(playUci(fenAt(explorer.line), uci)?.sound ?? "move");
  explorer.line = line;
  render(explorer, false);
}

function start(explorer: Explorer, mode: ExploreMode, line: ExploreLine, shouldReply: boolean): void {
  const isFirstView = explorer.line === null;
  explorer.mode = mode;
  explorer.line = line;
  render(explorer, shouldReply);
  // Sur téléphone, les boutons sont sous le texte : on remonte au plateau, où tout se passe désormais.
  if (isFirstView) {
    explorer.elements.panel.parentElement?.scrollIntoView({ block: "start" });
  }
}

/** Coup de la partie puis la réfutation du moteur, cherchée dans la position d'après. */
async function startGameLine(explorer: Explorer, puzzle: Puzzle): Promise<void> {
  const gameUci = sanLineToUci(puzzle.fen, [puzzle.playedSan])[0];
  const after = gameUci === undefined ? null : playUci(puzzle.fen, gameUci);
  if (gameUci === undefined || after === null) {
    return;
  }
  start(explorer, "game", createLine(puzzle.fen, [gameUci]), false);
  try {
    const refutation = await explorer.options.engine.bestLine(after.fen);
    if (explorer.mode === "game" && explorer.puzzle === puzzle && refutation !== null) {
      start(explorer, "game", createLine(puzzle.fen, [gameUci, ...refutation.pvUci.slice(0, REFUTATION_PLIES)]), false);
    }
  } catch {
    setText(explorer.elements.evaluation, "Le moteur n'a pas pu démarrer : la réfutation n'est pas disponible.");
  }
}

function step(explorer: Explorer, delta: number): void {
  const line = explorer.line;
  if (line === null) {
    return;
  }
  const moved = goTo(line, line.index + delta);
  if (moved.index === line.index) {
    return;
  }
  const arrived = lastMoveOf(moved);
  if (delta > 0 && arrived !== null) {
    explorer.options.sound.play(playUci(fenAt(line), arrived)?.sound ?? "move");
  }
  explorer.line = moved;
  render(explorer, false);
}

const KEY_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, Home: -999, End: 999 };

/** Flèches du clavier hors du plateau (qui s'en sert pour changer de case) et hors des champs de saisie. */
function attachKeyboard(explorer: Explorer): void {
  document.addEventListener("keydown", (event) => {
    const delta = KEY_STEPS[event.key];
    const target = event.target instanceof Element ? event.target : null;
    const isElsewhere = target !== null && target.closest("#board, input, textarea, select, dialog") !== null;
    if (delta === undefined || explorer.line === null || isElsewhere) {
      return;
    }
    event.preventDefault();
    step(explorer, delta);
  });
}

function attachButtons(explorer: Explorer): void {
  const on = (id: string, action: (puzzle: Puzzle) => void) => {
    requireElement(id, HTMLButtonElement).addEventListener("click", () => {
      if (explorer.puzzle !== null) {
        action(explorer.puzzle);
      }
    });
  };
  on("explore-continue", (puzzle) => {
    start(explorer, "free", createLine(puzzle.fen, [explorer.solvedUci], 1), true);
  });
  on("explore-line", (puzzle) => {
    start(explorer, "line", createLine(puzzle.fen, sanLineToUci(puzzle.fen, puzzle.solutionLine)), false);
  });
  on("explore-game", (puzzle) => {
    void startGameLine(explorer, puzzle);
  });
  on("explore-reset", (puzzle) => {
    start(explorer, "free", createLine(puzzle.fen), false);
  });
  explorer.elements.prev.addEventListener("click", () => {
    step(explorer, -1);
  });
  explorer.elements.next.addEventListener("click", () => {
    step(explorer, 1);
  });
}

/**
 * Après un problème : rejouer la position pour comprendre pourquoi le coup est le meilleur. Rien de
 * ce qui est joué ici ne compte pour la révision espacée : le résultat du problème est déjà gardé.
 */
export function createExploreView(options: ExploreOptions): ExploreView {
  const explorer: Explorer = {
    options,
    elements: collectElements(),
    puzzle: null,
    solvedUci: "",
    mode: "free",
    line: null,
    requestId: 0,
    isEngineDown: false,
  };
  attachButtons(explorer);
  attachKeyboard(explorer);
  return {
    open: (puzzle, solvedUci) => {
      explorer.puzzle = puzzle;
      explorer.solvedUci = solvedUci;
      explorer.line = null;
      explorer.requestId += 1;
      explorer.elements.panel.hidden = true;
    },
    close: () => {
      explorer.puzzle = null;
      explorer.line = null;
      explorer.requestId += 1;
      explorer.elements.panel.hidden = true;
    },
    handleMove: (uci) => {
      if (explorer.line === null || explorer.puzzle === null) {
        return false;
      }
      const line = playMove(explorer.line, uci);
      if (line === null) {
        return true;
      }
      options.sound.play(playUci(fenAt(explorer.line), uci)?.sound ?? "move");
      const isPlayerMove = sideToMove(fenAt(explorer.line)) === explorer.puzzle.playerColor;
      explorer.mode = "free";
      explorer.line = line;
      render(explorer, isPlayerMove && upcomingMove(line) === null);
      return true;
    },
  };
}
