/** Élément du gabarit `index.html`, typé. Une erreur ici signale un gabarit et un code désaccordés. */
export function requireElement<ElementType extends HTMLElement>(
  id: string,
  elementClass: new () => ElementType,
): ElementType {
  const element = document.getElementById(id);
  if (!(element instanceof elementClass)) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

/** Écrit un texte seulement s'il change : la page n'est pas retouchée 60 fois par seconde. */
export function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) {
    element.textContent = text;
  }
}

/** Pose ou retire un attribut seulement s'il change. */
export function setAttribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

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
