import { byId, setHidden, setText } from "./dom.ts";

export interface OverlayAction {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface OverlayContent {
  readonly title: string;
  readonly text: string;
  readonly primary: OverlayAction;
  readonly secondary?: OverlayAction;
}

/**
 * Fenêtre posée sur la carte (pause, reprise d'une partie, défaite). À l'ouverture, le focus va sur
 * le bouton principal ; à la fermeture, il revient à `returnFocus` (la carte).
 */
export class Overlay {
  private readonly root = byId<HTMLElement>("overlay");
  private readonly title = byId<HTMLElement>("overlay-title");
  private readonly text = byId<HTMLElement>("overlay-text");
  private readonly primaryButton = byId<HTMLButtonElement>("overlay-primary");
  private readonly secondaryButton = byId<HTMLButtonElement>("overlay-secondary");
  private content: OverlayContent | null = null;
  private readonly returnFocus: HTMLElement;

  constructor(returnFocus: HTMLElement) {
    this.returnFocus = returnFocus;
    this.primaryButton.addEventListener("click", () => this.content?.primary.onSelect());
    this.secondaryButton.addEventListener("click", () => this.content?.secondary?.onSelect());
  }

  get isOpen(): boolean {
    return this.content !== null;
  }

  show(content: OverlayContent): void {
    this.content = content;
    setText(this.title, content.title);
    setText(this.text, content.text);
    setText(this.primaryButton, content.primary.label);
    setText(this.secondaryButton, content.secondary?.label ?? "");
    setHidden(this.secondaryButton, !content.secondary);
    setHidden(this.root, false);
    this.primaryButton.focus();
  }

  hide(): void {
    if (!this.content) return;
    this.content = null;
    setHidden(this.root, true);
    this.returnFocus.focus();
  }
}
