import type { GameReviewData, PlyReview, SideSummary } from "../game/gameReview.ts";
import { MOVE_CLASS_ORDER } from "../game/moveClass.ts";
import { formatSeconds, moveNumberLabel, sideName } from "../game/reviewFormat.ts";
import type { PlayerColor } from "../game/types.ts";
import { formatDecimal } from "./format.ts";
import { createMoveIcon, moveClassLabel } from "./moveIcons.ts";
import { playUci } from "./puzzleText.ts";

function element(tagName: string, className: string, text = ""): HTMLElement {
  const created = document.createElement(tagName);
  created.className = className;
  created.textContent = text;
  return created;
}

/** Nom du meilleur coup du moteur en notation française, ou `null` quand le coup joué l'était. */
export function bestMoveName(ply: PlyReview): string | null {
  if (ply.bestUci === "" || ply.bestUci === ply.uci) {
    return null;
  }
  return playUci(ply.fenBefore, ply.bestUci)?.san ?? null;
}

function timeText(ply: PlyReview): string {
  if (ply.spentSeconds === null) {
    return "";
  }
  const zeitnot = ply.isZeitnot ? ", en zeitnot" : "";
  return `${formatSeconds(ply.spentSeconds)}${zeitnot}`;
}

function moveButton(ply: PlyReview, onSelect: (index: number) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `review-move move-${ply.moveClass}`;
  button.dataset["index"] = String(ply.ply + 1);
  const time = timeText(ply);
  const timeLabel = time === "" ? "" : `, ${time}`;
  button.setAttribute("aria-label", `${moveNumberLabel(ply)}, ${sideName(ply.color)}, ${moveClassLabel(ply.moveClass)}${timeLabel}`);
  const timeTag = element("span", `review-time${ply.isZeitnot ? " is-zeitnot" : ""}${ply.isLongThink ? " is-long" : ""}`, time === "" ? "" : formatSeconds(ply.spentSeconds ?? 0));
  button.append(createMoveIcon(ply.moveClass), element("span", "review-san", moveNumberLabel(ply).split(" ")[1] ?? ply.san), timeTag);
  button.addEventListener("click", () => {
    onSelect(ply.ply + 1);
  });
  return button;
}

/** Liste des coups, une ligne par coup complet (blancs puis noirs), chaque demi-coup cliquable. */
export function renderMoveList(list: HTMLElement, review: GameReviewData, onSelect: (index: number) => void): void {
  const rows: HTMLElement[] = [];
  review.plies.forEach((ply) => {
    if (ply.color === "white" || rows.length === 0) {
      const row = element("li", "review-row");
      row.append(element("span", "review-number", `${Math.floor(ply.ply / 2) + 1}.`));
      if (ply.color === "black") {
        row.append(element("span", "review-move-empty", "…"));
      }
      rows.push(row);
    }
    rows[rows.length - 1]?.append(moveButton(ply, onSelect));
  });
  list.replaceChildren(...rows);
}

/** Met en avant le coup affiché dans la liste et le garde en vue. */
export function markCurrentMove(list: HTMLElement, index: number): void {
  list.querySelectorAll<HTMLButtonElement>(".review-move").forEach((button) => {
    const isCurrent = button.dataset["index"] === String(index);
    button.classList.toggle("is-current", isCurrent);
    if (isCurrent) {
      button.setAttribute("aria-current", "step");
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function summaryCell(summary: SideSummary, moveClass: (typeof MOVE_CLASS_ORDER)[number]): HTMLElement {
  return element("td", "number", String(summary.counts[moveClass]));
}

/** Résumé : précision des deux joueurs, puis le nombre de coups de chaque avis, par camp. */
export function renderSummary(body: HTMLElement, review: GameReviewData): void {
  const accuracyRow = document.createElement("tr");
  accuracyRow.append(
    element("th", "", "Précision"),
    element("td", "number", `${formatDecimal(review.white.accuracy)} %`),
    element("td", "number", `${formatDecimal(review.black.accuracy)} %`),
  );
  const classRows = MOVE_CLASS_ORDER.map((moveClass) => {
    const row = document.createElement("tr");
    const label = element("th", "review-class");
    label.append(createMoveIcon(moveClass), element("span", "", moveClassLabel(moveClass)));
    row.append(label, summaryCell(review.white, moveClass), summaryCell(review.black, moveClass));
    return row;
  });
  [accuracyRow, ...classRows].forEach((row) => {
    row.firstElementChild?.setAttribute("scope", "row");
  });
  body.replaceChildren(accuracyRow, ...classRows);
}

/** Chances de gain dites du côté de celui qui regarde (le joueur), arrondies. */
export function describeWin(whiteWin: number, orientation: PlayerColor): string {
  const share = Math.round(orientation === "white" ? whiteWin : 100 - whiteWin);
  return `Vos chances de gain : ${share} %.`;
}

/** Commentaire du coup affiché : avis, meilleur coup du moteur, temps passé. */
export function describePly(ply: PlyReview | null, orientation: PlayerColor, startWin: number): string {
  if (ply === null) {
    return `Position de départ. ${describeWin(startWin, orientation)}`;
  }
  const best = bestMoveName(ply);
  const bestText = best === null ? "" : ` Le moteur proposait ${best} (flèche verte).`;
  const time = timeText(ply);
  const timeSentence = time === "" ? "" : ` Joué en ${time}.`;
  return `${moveNumberLabel(ply)} (${sideName(ply.color)}) : ${moveClassLabel(ply.moveClass)}.${bestText}${timeSentence} ${describeWin(ply.whiteWinAfter, orientation)}`;
}

/** Part des blancs pour la barre d'évaluation : jamais tout à fait vide ni pleine, pour rester visible. */
export function whiteShare(win: number): number {
  return Math.max(2, Math.min(98, win));
}
