import { TOWER_COST } from "../game/balance.ts";
import { COLS, ROWS, cellKey, isOnPath, type Cell } from "../game/grid.ts";
import type { GameState, Tower } from "../game/types.ts";
import { formatMoney, setAttribute } from "./dom.ts";

export interface BoardHandlers {
  /** Clic ou Entrée sur une case : poser une tourelle ou sélectionner celle qui s'y trouve. */
  onActivate(cell: Cell): void;
  /** Case survolée ou focalisée (`null` en sortant de la carte) : le rendu y montre la portée. */
  onHover(cell: Cell | null): void;
}

export interface Board {
  /** Met à jour le nom accessible des cases quand les tourelles changent. */
  refresh(state: GameState): void;
  focusCell(cell: Cell): void;
}

const ARROW_MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function cellName(cell: Cell): string {
  return `Colonne ${cell.col + 1}, ligne ${cell.row + 1}`;
}

function cellLabel(cell: Cell, tower: Tower | undefined): string {
  if (tower === undefined) {
    return `${cellName(cell)} : libre, poser une tourelle (${formatMoney(TOWER_COST)})`;
  }
  const { damage, range, rate } = tower.levels;
  return `${cellName(cell)} : tourelle, dégâts ${damage}, portée ${range}, cadence ${rate}`;
}

function towersSignature(towers: readonly Tower[]): string {
  return towers.map((tower) => `${cellKey(tower)}:${tower.levels.damage}${tower.levels.range}${tower.levels.rate}`).join("|");
}

function cellOf(button: HTMLElement): Cell {
  return { col: Number(button.dataset.col), row: Number(button.dataset.row) };
}

/**
 * Construit la grille de boutons posée sur le canvas. Les cases du chemin sont de simples
 * emplacements vides ; chaque case constructible est un vrai `<button>`. Une seule case est dans
 * l'ordre de tabulation, les flèches déplacent le focus (grille à « tabindex » itinérant).
 */
export function createBoard(container: HTMLElement, handlers: BoardHandlers): Board {
  const buttons = new Map<string, HTMLButtonElement>();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = { col, row };
      if (isOnPath(cell)) {
        container.append(document.createElement("span"));
        continue;
      }
      const button = createCellButton(cell, buttons.size === 0);
      buttons.set(cellKey(cell), button);
      container.append(button);
    }
  }
  bindBoardEvents(container, buttons, handlers);

  let lastSignature: string | null = null;
  return {
    refresh(state) {
      const signature = towersSignature(state.towers);
      if (signature === lastSignature) {
        return;
      }
      lastSignature = signature;
      const towersByCell = new Map(state.towers.map((tower) => [cellKey(tower), tower]));
      for (const [key, button] of buttons) {
        setAttribute(button, "aria-label", cellLabel(cellOf(button), towersByCell.get(key)));
      }
    },
    focusCell(cell) {
      const button = buttons.get(cellKey(cell));
      if (button !== undefined) {
        moveFocus(buttons, button);
      }
    },
  };
}

function createCellButton(cell: Cell, isFirst: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cell";
  button.dataset.col = String(cell.col);
  button.dataset.row = String(cell.row);
  button.tabIndex = isFirst ? 0 : -1;
  return button;
}

function moveFocus(buttons: ReadonlyMap<string, HTMLButtonElement>, target: HTMLButtonElement): void {
  for (const button of buttons.values()) {
    button.tabIndex = button === target ? 0 : -1;
  }
  target.focus();
}

/** Prochaine case constructible dans la direction donnée : les cases du chemin sont enjambées. */
function nextButton(
  buttons: ReadonlyMap<string, HTMLButtonElement>,
  from: Cell,
  move: readonly [number, number],
): HTMLButtonElement | undefined {
  let col = from.col + move[0];
  let row = from.row + move[1];
  while (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
    const button = buttons.get(cellKey({ col, row }));
    if (button !== undefined) {
      return button;
    }
    col += move[0];
    row += move[1];
  }
  return undefined;
}

function bindBoardEvents(
  container: HTMLElement,
  buttons: ReadonlyMap<string, HTMLButtonElement>,
  handlers: BoardHandlers,
): void {
  const buttonFrom = (event: Event): HTMLButtonElement | null =>
    event.target instanceof HTMLButtonElement ? event.target : null;

  container.addEventListener("click", (event) => {
    const button = buttonFrom(event);
    if (button !== null) {
      moveFocus(buttons, button);
      handlers.onActivate(cellOf(button));
    }
  });
  container.addEventListener("keydown", (event) => {
    const button = buttonFrom(event);
    const move = ARROW_MOVES[event.key];
    if (button === null || move === undefined) {
      return;
    }
    event.preventDefault();
    const target = nextButton(buttons, cellOf(button), move);
    if (target !== undefined) {
      moveFocus(buttons, target);
    }
  });
  const reportHover = (event: Event): void => {
    const button = buttonFrom(event);
    handlers.onHover(button === null ? null : cellOf(button));
  };
  container.addEventListener("pointerover", reportHover);
  container.addEventListener("focusin", reportHover);
  container.addEventListener("pointerleave", () => handlers.onHover(null));
  container.addEventListener("focusout", () => handlers.onHover(null));
}
