import { requireElement, setText } from "../../shared/dom.ts";
import { PASSIVES, PASSIVE_IDS, UNLOCKS, WEAPONS, WEAPON_IDS } from "../game/balance.ts";
import type { Profile, RunSummary } from "../game/profile.ts";
import type { GameState } from "../game/types.ts";
import { describeChoice, formatCoins, formatNumber, formatTime } from "./texts.ts";

export interface DialogHandlers {
  readonly onChoose: (choiceIndex: number) => void;
  readonly onResume: () => void;
  readonly onAbandon: () => void;
  readonly onReplay: () => void;
  readonly onMenu: () => void;
}

export interface Dialogs {
  /** Affiche les cartes du passage de niveau (ou les remplace si un autre niveau suit). */
  showLevelUp(state: GameState): void;
  hideLevelUp(): void;
  showPause(state: GameState): void;
  hidePause(): void;
  showEnd(summary: RunSummary, profile: Profile): void;
  hideEnd(): void;
}

interface ChoiceButton {
  readonly button: HTMLButtonElement;
  readonly tag: HTMLElement;
  readonly name: HTMLElement;
  readonly text: HTMLElement;
}

function createSpan(className: string, text = ""): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function buildChoiceButton(button: HTMLButtonElement, choiceIndex: number): ChoiceButton {
  const head = createSpan("choice-tag");
  const tag = createSpan("");
  head.append(tag, createSpan("choice-key", String(choiceIndex + 1)));
  const name = createSpan("choice-name");
  const text = createSpan("choice-text");
  button.append(head, name, text);
  return { button, tag, name, text };
}

/** Ce que le joueur a en main, rappelé sur l'écran de pause : « Étincelle 3, Halo 1 · Vigueur 2 ». */
function describeBuild(state: GameState): string {
  const weapons = WEAPON_IDS.filter((id) => state.weapons[id].level > 0).map(
    (id) => `${WEAPONS[id].name} ${state.weapons[id].level}`,
  );
  const passives = PASSIVE_IDS.filter((id) => state.passives[id] > 0).map(
    (id) => `${PASSIVES[id].name} ${state.passives[id]}`,
  );
  const parts = [`Niveau ${state.player.level}`, weapons.join(", ")];
  if (passives.length > 0) {
    parts.push(passives.join(", "));
  }
  return parts.join(" · ");
}

function fillEnd(summary: RunSummary, profile: Profile): void {
  setText(requireElement("end-title", HTMLElement), summary.hasWon ? "L'aube se lève" : "La nuit a gagné");
  setText(requireElement("end-score", HTMLElement), `${formatNumber(summary.score)} points`);
  const recordText = summary.isNewRecord ? "Nouveau record !" : `Record : ${formatNumber(profile.bestScore)} points`;
  setText(requireElement("end-record", HTMLElement), recordText);
  setText(requireElement("end-time", HTMLElement), formatTime(summary.seconds));
  setText(requireElement("end-kills", HTMLElement), formatNumber(summary.kills));
  setText(requireElement("end-level", HTMLElement), String(summary.level));
  setText(requireElement("end-coins", HTMLElement), `+ ${formatCoins(summary.coins)} (${formatNumber(profile.coins)} en tout)`);
  const canUnlock = UNLOCKS.some((unlock) => !profile.unlocked.includes(unlock.id) && unlock.cost <= profile.coins);
  requireElement("end-unlock-hint", HTMLElement).hidden = !canUnlock;
}

/**
 * Relie les trois fenêtres du jeu. Ce sont de vrais `<dialog>` modaux : le focus y est enfermé et
 * Tab / Entrée suffisent. Échap ferme la pause (reprise) et l'écran de fin (retour au menu), mais
 * pas le choix d'amélioration, qui se rouvre tant qu'une carte n'est pas prise.
 */
export function createDialogs(handlers: DialogHandlers): Dialogs {
  const levelUp = requireElement("level-up", HTMLDialogElement);
  const levelUpTitle = requireElement("level-up-title", HTMLElement);
  const pause = requireElement("pause-dialog", HTMLDialogElement);
  const end = requireElement("end-dialog", HTMLDialogElement);
  const choiceButtons = [...levelUp.querySelectorAll<HTMLButtonElement>(".choice")].map(buildChoiceButton);
  /** Fenêtres que le jeu veut ouvertes : une fermeture hors de cette liste vient du joueur (Échap). */
  const wanted = new Set<HTMLDialogElement>();

  const show = (dialog: HTMLDialogElement): void => {
    wanted.add(dialog);
    if (!dialog.open) {
      dialog.showModal();
    }
  };
  const hide = (dialog: HTMLDialogElement): void => {
    wanted.delete(dialog);
    dialog.close();
  };
  const onDismiss = (dialog: HTMLDialogElement, react: () => void): void => {
    dialog.addEventListener("close", () => {
      if (wanted.has(dialog)) {
        react();
      }
    });
  };

  choiceButtons.forEach((choice, choiceIndex) => {
    choice.button.addEventListener("click", () => handlers.onChoose(choiceIndex));
  });
  levelUp.addEventListener("cancel", (event) => event.preventDefault());
  onDismiss(levelUp, () => levelUp.showModal());
  onDismiss(pause, () => {
    wanted.delete(pause);
    handlers.onResume();
  });
  onDismiss(end, () => {
    wanted.delete(end);
    handlers.onMenu();
  });
  requireElement("resume", HTMLButtonElement).addEventListener("click", handlers.onResume);
  requireElement("abandon", HTMLButtonElement).addEventListener("click", handlers.onAbandon);
  requireElement("replay", HTMLButtonElement).addEventListener("click", handlers.onReplay);
  requireElement("to-menu", HTMLButtonElement).addEventListener("click", handlers.onMenu);

  return {
    showLevelUp(state) {
      setText(levelUpTitle, `Niveau ${state.player.level - state.pendingLevelUps + 1}`);
      choiceButtons.forEach((choice, choiceIndex) => {
        const offered = state.choices[choiceIndex];
        choice.button.hidden = offered === undefined;
        if (offered !== undefined) {
          const card = describeChoice(offered);
          setText(choice.tag, card.tag);
          setText(choice.name, card.name);
          setText(choice.text, card.text);
        }
      });
      show(levelUp);
      choiceButtons[0]?.button.focus();
    },
    hideLevelUp: () => hide(levelUp),
    showPause(state) {
      setText(requireElement("pause-build", HTMLElement), describeBuild(state));
      show(pause);
    },
    hidePause: () => hide(pause),
    showEnd(summary, profile) {
      fillEnd(summary, profile);
      show(end);
    },
    hideEnd: () => hide(end),
  };
}
