/** Élément du gabarit HTML de la page, typé. Une erreur ici signale un gabarit et un code désaccordés. */
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
