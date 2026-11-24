import { GAUGES } from "../game/types.ts";
import type { GameApp } from "./app.ts";
import { cellFromPointer, moveCursor } from "./board.ts";
import { byId, query } from "./dom.ts";

function bindBoard(app: GameApp): void {
  const { canvas } = app;
  canvas.addEventListener("mousemove", (event) => app.setCursor(cellFromPointer(canvas, event)));
  canvas.addEventListener("mouseleave", () => app.setCursor(null));
  canvas.addEventListener("click", (event) => {
    const cell = cellFromPointer(canvas, event);
    if (cell) app.actOnCell(cell);
  });
  canvas.addEventListener("keydown", (event) => onBoardKey(app, event));
}

function onBoardKey(app: GameApp, event: KeyboardEvent): void {
  const moved = moveCursor(app.currentCursor, event.key);
  if (moved) {
    event.preventDefault();
    app.setCursor(moved);
    app.describeCursor();
    return;
  }
  const cursor = app.currentCursor;
  if ((event.key === "Enter" || event.key === " ") && cursor) {
    event.preventDefault();
    app.actOnCell(cursor);
  } else if (event.key === "Escape") {
    app.deselect();
  }
}

function bindButtons(app: GameApp): void {
  byId<HTMLButtonElement>("next-wave").addEventListener("click", () => app.callNextWave());
  byId<HTMLButtonElement>("speed").addEventListener("click", () => app.toggleSpeed());
  byId<HTMLButtonElement>("pause").addEventListener("click", () => app.togglePause());
  byId<HTMLButtonElement>("sell").addEventListener("click", () => app.sellSelected());
  for (const gauge of GAUGES) {
    const button = query<HTMLButtonElement>(document, `.gauge[data-gauge="${gauge}"] .upgrade`);
    button.addEventListener("click", () => app.upgrade(gauge));
  }
}

/** Souris et clavier : carte (survol, clic, flèches, Entrée, Échap), boutons, et pause quand l'onglet est quitté. */
export function bindInputs(app: GameApp): void {
  bindBoard(app);
  bindButtons(app);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) app.pause();
  });
}
