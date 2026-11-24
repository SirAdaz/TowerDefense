/** Élément obligatoire de index.html : une absence est un bug de balisage, on échoue tout de suite. */
export function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} in index.html`);
  return element as T;
}

export function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector} in index.html`);
  return element;
}

/** N'écrit que si le texte change : l'interface est mise à jour à chaque image sans toucher au DOM pour rien. */
export function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

export function setAttr(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

export function setDisabled(button: HTMLButtonElement, isDisabled: boolean): void {
  if (button.disabled !== isDisabled) button.disabled = isDisabled;
}

export function setHidden(element: HTMLElement, isHidden: boolean): void {
  if (element.hidden !== isHidden) element.hidden = isHidden;
}
