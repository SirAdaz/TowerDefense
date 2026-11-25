import { requireElement, setAttribute, setText } from "../../shared/dom.ts";
import { UNLOCKS } from "../game/balance.ts";
import { unlockCost, type Profile } from "../game/profile.ts";
import type { UpgradeId } from "../game/types.ts";
import { describeRecord, formatCoins } from "./format.ts";
import { describeUpgrade } from "./texts.ts";

export interface MenuHandlers {
  readonly onPlay: () => void;
  readonly onUnlock: (id: UpgradeId) => void;
}

export interface Menu {
  setVisible(isVisible: boolean): void;
  /** Met à jour le record, les pièces et l'état de chaque déblocage. */
  refresh(profile: Profile): void;
  focusPlay(): void;
}

interface UnlockRow {
  readonly id: UpgradeId;
  readonly button: HTMLButtonElement;
  readonly owned: HTMLElement;
}

function createSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

/** Une ligne par déblocage : nom, genre, effet, et un bouton d'achat remplacé par « Débloqué ». */
function createUnlockRow(id: UpgradeId, onUnlock: (id: UpgradeId) => void): { row: UnlockRow; item: HTMLLIElement } {
  const card = describeUpgrade(id);
  const item = document.createElement("li");
  item.className = "unlock";
  const name = createSpan("unlock-name", card.name);
  name.append(createSpan("unlock-kind", card.tag));
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-small";
  button.addEventListener("click", () => {
    if (button.getAttribute("aria-disabled") !== "true") {
      onUnlock(id);
    }
  });
  const owned = createSpan("unlock-owned", "Débloqué");
  item.append(name, createSpan("unlock-text", card.text), button, owned);
  return { row: { id, button, owned }, item };
}

function refreshUnlockRow(row: UnlockRow, profile: Profile): void {
  const cost = unlockCost(profile, row.id);
  row.button.hidden = cost === null;
  row.owned.hidden = cost !== null;
  if (cost === null) {
    return;
  }
  const isTooExpensive = cost > profile.coins;
  setText(row.button, `Débloquer · ${formatCoins(cost)}`);
  // `aria-disabled` plutôt que `disabled` : le bouton reste atteignable au clavier et garde le focus.
  setAttribute(row.button, "aria-disabled", String(isTooExpensive));
}

/** Relie le menu de `nuit-blanche/index.html` : bouton Jouer, record, pièces et déblocages. */
export function createMenu(handlers: MenuHandlers): Menu {
  const root = requireElement("menu", HTMLElement);
  const playButton = requireElement("play", HTMLButtonElement);
  const record = requireElement("menu-record", HTMLElement);
  const coins = requireElement("menu-coins", HTMLElement);
  const list = requireElement("unlocks", HTMLElement);
  const rows = UNLOCKS.map((unlock) => {
    const { row, item } = createUnlockRow(unlock.id, handlers.onUnlock);
    list.append(item);
    return row;
  });
  playButton.addEventListener("click", handlers.onPlay);

  return {
    setVisible(isVisible) {
      root.hidden = !isVisible;
    },
    refresh(profile) {
      const recordText = describeRecord(profile);
      record.hidden = recordText === null;
      setText(record, recordText ?? "");
      setText(coins, formatCoins(profile.coins));
      for (const row of rows) {
        refreshUnlockRow(row, profile);
      }
    },
    focusPlay() {
      playButton.focus();
    },
  };
}
