import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { formatLine, squareAt } from "../game/notation.ts";
import { openingLine } from "../game/openingGuide.ts";
import type { OpeningStat } from "../game/report.ts";
import { SMALL_SAMPLE_GAMES } from "../game/report.ts";
import { createPiece } from "./pieces.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function element(tagName: string, className: string, text = ""): HTMLElement {
  const created = document.createElement(tagName);
  created.className = className;
  created.textContent = text;
  return created;
}

/** Petit échiquier en lecture seule, vu des blancs ; décrit en une phrase pour les lecteurs d'écran. */
function createMiniBoard(fen: string, description: string): HTMLElement {
  const chess = new Chess(fen);
  const board = element("div", "mini-board");
  board.setAttribute("role", "img");
  board.setAttribute("aria-label", description);
  for (let index = 0; index < 64; index += 1) {
    const square = squareAt(Math.floor(index / 8), index % 8, "white");
    const cell = element("span", `mini-square${(Math.floor(index / 8) + index) % 2 === 1 ? " mini-dark" : ""}`);
    const piece = chess.get(square as Square);
    if (piece !== undefined) {
      cell.append(createPiece(piece.type, piece.color));
    }
    board.append(cell);
  }
  return board;
}

let detailsCount = 0;

/** Bouton qui montre ou cache la position d'arrivée de l'ouverture (clic ou doigt, pas de survol seul). */
function positionToggle(fen: string, line: string): HTMLElement[] {
  detailsCount += 1;
  const panelId = `opening-board-${detailsCount}`;
  const button = element("button", "btn opening-toggle", "Voir la position") as HTMLButtonElement;
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", panelId);
  const panel = createMiniBoard(fen, `Position après ${line}`);
  panel.id = panelId;
  panel.hidden = true;
  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.textContent = panel.hidden ? "Voir la position" : "Cacher la position";
  });
  return [button, panel];
}

/** Cellule d'une ouverture : le nom du site (anglais), ses premiers coups en français, son idée, sa position. */
export function openingCell(opening: OpeningStat): HTMLElement {
  const cell = element("th", "opening-cell");
  cell.setAttribute("scope", "row");
  cell.append(element("span", "opening-name", opening.name));
  const line = openingLine(opening.name, opening.pgn);
  if (line === null) {
    return cell;
  }
  const moves = formatLine(START_FEN, line.sanMoves);
  cell.append(element("span", "opening-moves", moves));
  if (line.idea !== null) {
    cell.append(element("span", "opening-idea", line.idea));
  }
  cell.append(...positionToggle(line.fen, moves));
  return cell;
}

/** Part de victoires, avec une mise en garde quand l'échantillon est trop petit pour conclure. */
export function winRateCell(opening: OpeningStat): HTMLElement {
  const cell = element("td", "number", `${Math.round(opening.winRate)} %`);
  if (opening.gameCount < SMALL_SAMPLE_GAMES) {
    cell.append(element("span", "small-sample", "peu de parties"));
  }
  return cell;
}
