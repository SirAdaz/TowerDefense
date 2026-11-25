import { Chess } from "chess.js";
import { frenchSan } from "../game/notation.ts";
import { nextDueAt } from "../game/schedule.ts";
import { countSolved } from "../game/summary.ts";
import type { Puzzle } from "../game/types.ts";
import { parseUciMove } from "../game/uci.ts";
import { describeDelay, pluralize } from "./format.ts";

/** Ouvre le choix de la pièce de promotion ; Échap ferme sans choisir. */
export function askPromotion(dialog: HTMLDialogElement): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener(
      "close",
      () => {
        resolve(dialog.returnValue === "" ? null : dialog.returnValue);
      },
      { once: true },
    );
    dialog.showModal();
  });
}

/** Position après un coup UCI et nom du coup en notation française ; `null` s'il est impossible. */
export function playUci(fen: string, uci: string): { fen: string; san: string } | null {
  const move = parseUciMove(uci);
  if (move === null) {
    return null;
  }
  try {
    const chess = new Chess(fen);
    const san = frenchSan(chess.move(move).san);
    return { fen: chess.fen(), san };
  } catch {
    return null;
  }
}

export function describeCounts(puzzles: readonly Puzzle[], dueCount: number): string {
  if (puzzles.length === 0) {
    return "";
  }
  const solvedCount = countSolved(puzzles);
  return `${dueCount} à faire · ${puzzles.length} en tout · ${pluralize(solvedCount, "réussi", "réussis")}`;
}

export function describeEmpty(puzzles: readonly Puzzle[], now: number): string {
  if (puzzles.length === 0) {
    return "Aucun problème pour l'instant. Donnez votre pseudo chess.com ci-dessous : chaque gaffe de vos parties deviendra un problème.";
  }
  const nextDue = nextDueAt(puzzles, now);
  const nextText = nextDue === null ? "" : ` Prochaine révision ${describeDelay(nextDue, now)}.`;
  return `Séance terminée : tout est fait pour aujourd'hui.${nextText}`;
}

/** Réponse à un coup refusé : dire si c'est la gaffe de la partie aide à comprendre pourquoi on la rejoue. */
export function describeWrongMove(puzzle: Puzzle, moveName: string): string {
  const isGameMove = frenchSan(puzzle.playedSan) === moveName;
  const reason = isGameMove ? "c'est le coup que vous aviez joué dans la partie" : "ce n'est pas le meilleur coup";
  return `${moveName} : ${reason}. Réessayez, ou regardez la solution.`;
}

export function describeRightMove(puzzle: Puzzle, uci: string, moveName: string): string {
  const bestMove = puzzle.solutions[0];
  if (bestMove === undefined || bestMove.uci === uci) {
    return `Bien vu : ${moveName}.`;
  }
  return `Bien vu : ${moveName}. Le moteur préfère ${frenchSan(bestMove.san)}, mais votre coup le vaut.`;
}
