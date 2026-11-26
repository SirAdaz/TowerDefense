import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { FILES, squareAt, squareLabel } from "../game/notation.ts";
import type { PlayerColor } from "../game/types.ts";
import { attachBoardInput } from "./boardInput.ts";
import { createArrowLayer, drawArrows } from "./boardOverlay.ts";
import type { BoardArrow, BoardBadge } from "./boardOverlay.ts";
import { createPiece } from "./pieces.ts";

/** Ce que le plateau montre : une position, vue d'un camp, avec ses repères. */
export interface BoardPosition {
  readonly fen: string;
  readonly orientation: PlayerColor;
  /** Dernier coup joué (UCI), surligné. */
  readonly lastMoveUci: string | null;
  /** Case mise en avant par l'indice. */
  readonly hintSquare: string | null;
  /** Faux : le plateau se regarde, les pièces ne bougent plus. */
  readonly isInteractive: boolean;
  /** Coups dessinés en flèches (solution, meilleur coup du moteur). */
  readonly arrows?: readonly BoardArrow[];
  /** Cases colorées un instant : coup refusé (`error`) ou trouvé (`success`). */
  readonly marks?: readonly SquareMark[];
  /** Avis sur le dernier coup (revue de partie). */
  readonly badge?: BoardBadge;
}

export interface SquareMark {
  readonly square: string;
  readonly tone: "error" | "success";
}

export interface BoardOptions {
  readonly root: HTMLElement;
  /** Appelé avec le coup choisi (UCI). Le plateau ne le joue pas : il montre ce qu'on lui donne ensuite. */
  readonly onMove: (uci: string) => void;
  /** Demande la pièce de promotion (`q`, `r`, `b`, `n`), ou `null` si le joueur renonce. */
  readonly choosePromotion: () => Promise<string | null>;
}

export interface BoardView {
  show(position: BoardPosition): void;
  /** Secoue le plateau après un coup refusé (sauf si le joueur limite les animations, voir le CSS). */
  shake(): void;
  /** Redessine les flèches sans toucher aux pièces ni à la case choisie (réponse du moteur arrivée après coup). */
  setArrows(arrows: readonly BoardArrow[]): void;
}

interface BoardState {
  chess: Chess;
  position: BoardPosition;
  selected: string | null;
  targets: ReadonlySet<string>;
}

const BOARD_SIZE = 8;

const EMPTY_POSITION: BoardPosition = {
  fen: "8/8/8/8/8/8/8/8 w - - 0 1",
  orientation: "white",
  lastMoveUci: null,
  hintSquare: null,
  isInteractive: false,
};

function createSquares(root: HTMLElement): HTMLButtonElement[] {
  const buttons: HTMLButtonElement[] = [];
  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "square";
    button.tabIndex = index === 0 ? 0 : -1;
    buttons.push(button);
  }
  root.replaceChildren(...buttons);
  return buttons;
}

function isDarkSquare(square: string): boolean {
  return (FILES.indexOf(square.charAt(0)) + Number(square.charAt(1))) % 2 === 1;
}

function createCoord(text: string, className: string): HTMLElement {
  const coord = document.createElement("span");
  coord.className = `coord ${className}`;
  coord.setAttribute("aria-hidden", "true");
  coord.textContent = text;
  return coord;
}

/** Repères de bord : la lettre sur la rangée du bas, le chiffre sur la colonne de gauche. */
function edgeCoords(square: string, row: number, column: number): HTMLElement[] {
  const coords: HTMLElement[] = [];
  if (row === BOARD_SIZE - 1) {
    coords.push(createCoord(square.charAt(0), "coord-file"));
  }
  if (column === 0) {
    coords.push(createCoord(square.charAt(1), "coord-rank"));
  }
  return coords;
}

function renderSquare(button: HTMLButtonElement, index: number, state: BoardState): void {
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const square = squareAt(row, column, state.position.orientation);
  const piece = state.chess.get(square as Square) ?? null;
  const lastMove = state.position.lastMoveUci ?? "";
  const isSelected = state.selected === square;
  const isTarget = state.targets.has(square);
  button.dataset["square"] = square;
  const pieceDrawing = piece === null ? [] : [createPiece(piece.type, piece.color)];
  button.replaceChildren(...pieceDrawing, ...edgeCoords(square, row, column));
  button.setAttribute("aria-label", squareLabel(square, piece) + (isTarget ? ", coup possible" : ""));
  button.setAttribute("aria-pressed", String(isSelected));
  button.classList.toggle("square-dark", isDarkSquare(square));
  button.classList.toggle("is-selected", isSelected);
  button.classList.toggle("is-target", isTarget);
  button.classList.toggle("is-capture", isTarget && piece !== null);
  button.classList.toggle("is-last-move", lastMove.slice(0, 2) === square || lastMove.slice(2, 4) === square);
  button.classList.toggle("is-hint", state.position.hintSquare === square);
  applyMark(button, square, state.position.marks ?? []);
}

function applyMark(button: HTMLButtonElement, square: string, marks: readonly SquareMark[]): void {
  const tone = marks.find((mark) => mark.square === square)?.tone;
  button.classList.toggle("is-error", tone === "error");
  button.classList.toggle("is-success", tone === "success");
}

function shakeBoard(root: HTMLElement): void {
  root.classList.remove("is-shaking");
  // Relire la taille relance l'animation quand deux mauvais coups se suivent.
  void root.offsetWidth;
  root.classList.add("is-shaking");
}

/**
 * Échiquier fait de 64 vrais boutons : souris, doigt et clavier suivent le même chemin, chaque case a
 * un nom pour les lecteurs d'écran. Le camp du joueur est en bas.
 */
export function createBoard(options: BoardOptions): BoardView {
  const buttons = createSquares(options.root);
  const arrowLayer = createArrowLayer(options.root);
  options.root.addEventListener("animationend", () => {
    options.root.classList.remove("is-shaking");
  });
  const state: BoardState = { chess: new Chess(), position: EMPTY_POSITION, selected: null, targets: new Set() };

  const render = () => {
    buttons.forEach((button, index) => {
      renderSquare(button, index, state);
    });
  };

  const select = (square: string | null) => {
    state.selected = square;
    const moves = square === null ? [] : state.chess.moves({ square: square as Square, verbose: true });
    state.targets = new Set(moves.map((move) => move.to));
    render();
  };

  const playTo = async (target: string) => {
    const origin = state.selected;
    if (origin === null) {
      return;
    }
    const moves = state.chess.moves({ square: origin as Square, verbose: true }).filter((move) => move.to === target);
    const isPromotion = moves.some((move) => move.promotion !== undefined);
    const promotion = isPromotion ? await options.choosePromotion() : "";
    select(null);
    if (moves.length > 0 && promotion !== null) {
      options.onMove(`${origin}${target}${promotion}`);
    }
  };

  const canPick = (square: string) => {
    const piece = state.chess.get(square as Square);
    return state.position.isInteractive && piece !== undefined && piece.color === state.chess.turn();
  };

  attachBoardInput(options.root, {
    press: (square) => {
      if (state.targets.has(square)) {
        void playTo(square);
        return false;
      }
      const isPickable = canPick(square);
      select(isPickable ? square : null);
      return isPickable;
    },
    drop: (square) => {
      if (square !== null && state.targets.has(square)) {
        void playTo(square);
      }
    },
  });

  return {
    show: (position) => {
      state.position = position;
      state.chess = new Chess(position.fen);
      drawArrows(arrowLayer, position.arrows ?? [], position.orientation, position.badge ?? null);
      select(null);
    },
    shake: () => {
      shakeBoard(options.root);
    },
    setArrows: (arrows) => {
      drawArrows(arrowLayer, arrows, state.position.orientation, state.position.badge ?? null);
    },
  };
}
