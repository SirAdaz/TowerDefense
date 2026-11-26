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
import type { PlayerColor } from "../game/types.ts";
import type { BoardView } from "./board.ts";
import type { BoardArrow } from "./boardOverlay.ts";
import { playUci } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

export interface ExploreOptions {
  readonly board: BoardView;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
  /** Préfixe des identifiants du panneau (`explore` pour les problèmes, `review-explore` pour la revue). */
  readonly prefix: string;
  /** Zone de la page où les flèches du clavier pilotent cette exploration. */
  readonly root: HTMLElement;
}

/** Position d'où l'on explore : un problème, ou un coup d'une partie revue. */
export interface ExploreContext {
  readonly fen: string;
  readonly playerColor: PlayerColor;
  /** Meilleure suite connue (notation anglaise), vide si aucune. */
  readonly solutionLine: readonly string[];
  /** Coup joué dans la partie (notation anglaise), `null` si on n'en a pas. */
  readonly playedSan: string | null;
}

export interface ExploreView {
  /** Donne la position à explorer ; rien ne bouge tant qu'on ne choisit pas quoi regarder. */
  open(context: ExploreContext): void;
  close(): void;
  isActive(): boolean;
  /** Coup joué sur le plateau ; faux si l'exploration n'est pas en cours. */
  handleMove(uci: string): boolean;
  /** Joue `firstUci` depuis la position, puis le moteur répond : on continue la partie. */
  continueWith(firstUci: string): void;
  /** Rejoue la meilleure suite connue, coup par coup. */
  showLine(): void;
  /** Rejoue le coup de la partie puis la réfutation du moteur. */
  showGameMove(): void;
  /** Revient à la position de départ, pour y jouer librement. */
  reset(): void;
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
  context: ExploreContext | null;
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
  game: "Le coup de la partie, puis la réponse du moteur qui le punit.",
};

/** Longueur gardée de la réfutation : assez pour voir l'idée, sans dérouler toute une partie. */
const REFUTATION_PLIES = 8;

function collectElements(prefix: string): Elements {
  return {
    panel: requireElement(`${prefix}-panel`, HTMLElement),
    mode: requireElement(`${prefix}-mode`, HTMLElement),
    step: requireElement(`${prefix}-step`, HTMLElement),
    evaluation: requireElement(`${prefix}-eval`, HTMLElement),
    evalFill: requireElement(`${prefix}-eval-fill`, HTMLElement),
    prev: requireElement(`${prefix}-prev`, HTMLButtonElement),
    next: requireElement(`${prefix}-next`, HTMLButtonElement),
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

function showLine(explorer: Explorer, line: ExploreLine, context: ExploreContext, isInteractive: boolean): void {
  const upcoming = upcomingMove(line);
  const tone: BoardArrow["tone"] = explorer.mode === "game" && line.index === 0 ? "played" : "best";
  explorer.options.board.show({
    fen: fenAt(line),
    orientation: context.playerColor,
    lastMoveUci: lastMoveOf(line),
    hintSquare: null,
    isInteractive,
    arrows: upcoming === null ? [] : [{ uci: upcoming, tone }],
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
  const { line, context, elements } = explorer;
  if (line === null || context === null) {
    return;
  }
  const finished = gameOverText(fenAt(line));
  const isAsking = finished === null && !explorer.isEngineDown;
  showLine(explorer, line, context, finished === null && !(shouldReply && isAsking));
  explorer.requestId += 1;
  if (!isAsking) {
    setText(elements.evaluation, finished ?? "Moteur indisponible : explorez sans évaluation.");
    return;
  }
  setText(elements.evaluation, shouldReply ? "Le moteur réfléchit…" : "Évaluation en cours…");
  void evaluate(explorer, explorer.requestId, shouldReply);
}

async function evaluate(explorer: Explorer, requestId: number, shouldReply: boolean): Promise<void> {
  const { line, context, elements, options } = explorer;
  if (line === null || context === null) {
    return;
  }
  const fen = fenAt(line);
  try {
    const best = await options.engine.bestLine(fen);
    if (requestId !== explorer.requestId || best === null) {
      return;
    }
    if (shouldReply) {
      applyMove(explorer, best.moveUci, false);
      return;
    }
    const evaluation = describeEvaluation(best.score, sideToMove(fen) === context.playerColor);
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

/** Joue un coup au bout de la suite, avec son son ; le moteur répond si `shouldReply`. Faux si le coup est illégal. */
function applyMove(explorer: Explorer, uci: string, shouldReply: boolean): boolean {
  const line = explorer.line === null ? null : playMove(explorer.line, uci);
  if (line === null || explorer.line === null) {
    return false;
  }
  explorer.options.sound.play(playUci(fenAt(explorer.line), uci)?.sound ?? "move");
  explorer.line = line;
  render(explorer, shouldReply);
  return true;
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
async function startGameLine(explorer: Explorer, context: ExploreContext): Promise<void> {
  const gameUci = context.playedSan === null ? undefined : sanLineToUci(context.fen, [context.playedSan])[0];
  const after = gameUci === undefined ? null : playUci(context.fen, gameUci);
  if (gameUci === undefined || after === null) {
    return;
  }
  start(explorer, "game", createLine(context.fen, [gameUci]), false);
  try {
    const refutation = await explorer.options.engine.bestLine(after.fen);
    if (explorer.mode === "game" && explorer.context === context && refutation !== null) {
      start(explorer, "game", createLine(context.fen, [gameUci, ...refutation.pvUci.slice(0, REFUTATION_PLIES)]), false);
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

/**
 * Le clavier pilote la zone où l'on se trouve (problèmes ou revue), hors du plateau (ses flèches
 * changent de case) et hors des champs de saisie.
 */
export function isKeyForZone(event: KeyboardEvent, root: HTMLElement): boolean {
  const target = event.target instanceof Element ? event.target : null;
  const isElsewhere = target !== null && target.closest(".board, input, textarea, select, dialog") !== null;
  const isInZone = target === null || target === document.body || root.contains(target);
  return !isElsewhere && isInZone && !root.hidden && root.offsetParent !== null;
}

function attachControls(explorer: Explorer): void {
  document.addEventListener("keydown", (event) => {
    const delta = KEY_STEPS[event.key];
    if (delta === undefined || explorer.line === null || !isKeyForZone(event, explorer.options.root)) {
      return;
    }
    event.preventDefault();
    step(explorer, delta);
  });
  explorer.elements.prev.addEventListener("click", () => {
    step(explorer, -1);
  });
  explorer.elements.next.addEventListener("click", () => {
    step(explorer, 1);
  });
}

function stop(explorer: Explorer, context: ExploreContext | null): void {
  explorer.context = context;
  explorer.line = null;
  explorer.requestId += 1;
  explorer.elements.panel.hidden = true;
}

/**
 * Rejouer une position pour comprendre pourquoi un coup est le meilleur : jouer contre le moteur,
 * dérouler sa suite, ou voir la réfutation du coup de la partie. Rien ne compte pour la révision.
 */
export function createExploreView(options: ExploreOptions): ExploreView {
  const explorer: Explorer = {
    options,
    elements: collectElements(options.prefix),
    context: null,
    mode: "free",
    line: null,
    requestId: 0,
    isEngineDown: false,
  };
  attachControls(explorer);
  const withContext = (action: (context: ExploreContext) => void) => {
    if (explorer.context !== null) {
      action(explorer.context);
    }
  };
  return {
    open: (context) => {
      stop(explorer, context);
    },
    close: () => {
      stop(explorer, null);
    },
    isActive: () => explorer.line !== null,
    handleMove: (uci) => {
      const { line, context } = explorer;
      if (line === null || context === null) {
        return false;
      }
      const isPlayerMove = sideToMove(fenAt(line)) === context.playerColor;
      explorer.mode = "free";
      applyMove(explorer, uci, isPlayerMove);
      return true;
    },
    continueWith: (firstUci) => {
      withContext((context) => {
        start(explorer, "free", createLine(context.fen, [firstUci], 1), true);
      });
    },
    showLine: () => {
      withContext((context) => {
        start(explorer, "line", createLine(context.fen, sanLineToUci(context.fen, context.solutionLine)), false);
      });
    },
    showGameMove: () => {
      withContext((context) => {
        void startGameLine(explorer, context);
      });
    },
    reset: () => {
      withContext((context) => {
        start(explorer, "free", createLine(context.fen), false);
      });
    },
  };
}
