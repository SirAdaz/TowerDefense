import { setAttribute } from "../../shared/dom.ts";

export { requireElement, setAttribute, setText } from "../../shared/dom.ts";

/**
 * Bouton indisponible mais toujours atteignable au clavier : `aria-disabled` plutôt que `disabled`,
 * pour ne pas faire perdre le focus quand l'argent manque.
 */
export function setUnavailable(button: HTMLButtonElement, isUnavailable: boolean): void {
  setAttribute(button, "aria-disabled", String(isUnavailable));
}

export function isUnavailable(button: HTMLButtonElement): boolean {
  return button.getAttribute("aria-disabled") === "true";
}

/** Montant affiché au joueur. */
export function formatMoney(amount: number): string {
  return `${amount} $`;
}
