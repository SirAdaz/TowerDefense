import { pgnHeader } from "../game/pgn.ts";
import { sideName } from "../game/reviewFormat.ts";
import type { AnalysedGame, GameResult } from "../game/types.ts";
import { formatDay, formatDecimal, TIME_CLASS_NAMES } from "./format.ts";

const RESULT_NAMES: Readonly<Record<GameResult, string>> = { win: "Victoire", draw: "Nulle", loss: "Défaite" };

/** Adversaire lu dans le PGN gardé ; les parties analysées avant la revue ne l'ont pas encore. */
export function opponentName(game: AnalysedGame): string | null {
  if (game.timeline === undefined) {
    return null;
  }
  return pgnHeader(game.timeline.pgn, game.playerColor === "white" ? "Black" : "White");
}

function element(tagName: string, className: string, text = ""): HTMLElement {
  const created = document.createElement(tagName);
  created.className = className;
  created.textContent = text;
  return created;
}

function gameButton(game: AnalysedGame, onOpen: (game: AnalysedGame) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `game-item result-${game.result}`;
  const opponent = opponentName(game);
  const who = opponent === null ? "adversaire à relire" : `contre ${opponent}`;
  const details = `${TIME_CLASS_NAMES[game.timeClass]} · avec les ${sideName(game.playerColor)} · précision ${formatDecimal(game.accuracy)} %`;
  button.append(
    element("span", "game-result", RESULT_NAMES[game.result]),
    element("span", "game-main", `${formatDay(game.endTime * 1000)} · ${who}`),
    element("span", "game-details", details),
  );
  button.addEventListener("click", () => {
    onOpen(game);
  });
  return button;
}

/** Parties analysées, la plus récente d'abord ; les parties illisibles (sans coup évalué) n'y sont pas. */
export function renderGameList(list: HTMLElement, games: readonly AnalysedGame[], onOpen: (game: AnalysedGame) => void): void {
  const items = [...games]
    .filter((game) => game.moves.length > 0)
    .sort((a, b) => b.endTime - a.endTime)
    .map((game) => {
      const item = document.createElement("li");
      item.append(gameButton(game, onOpen));
      return item;
    });
  list.replaceChildren(...items);
}

export function describeGameTitle(game: AnalysedGame): string {
  const opponent = opponentName(game);
  const who = opponent === null ? "" : ` contre ${opponent}`;
  return `${RESULT_NAMES[game.result]}${who}, ${TIME_CLASS_NAMES[game.timeClass]} du ${formatDay(game.endTime * 1000)}`;
}
