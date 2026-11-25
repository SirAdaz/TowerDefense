/** Ce que le plateau fait d'un geste, quel que soit le périphérique. */
export interface BoardGestures {
  /** Appui sur une case (clic, doigt, Entrée). Renvoie vrai si la pièce de cette case peut être glissée. */
  press(square: string): boolean;
  /** Fin d'un glisser sur une case, ou `null` s'il finit hors du plateau. */
  drop(square: string | null): void;
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly origin: HTMLElement;
  ghost: SVGElement | null;
}

/** En dessous de ce déplacement (pixels), l'appui reste un clic : la pièce est choisie, pas glissée. */
const DRAG_THRESHOLD = 6;

const BOARD_SIZE = 8;

const ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -BOARD_SIZE,
  ArrowDown: BOARD_SIZE,
};

function squareButton(target: EventTarget | Element | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-square]") : null;
}

function squareName(button: HTMLElement | null): string | null {
  return button?.dataset["square"] ?? null;
}

/** Copie de la pièce qui suit le pointeur ; l'originale reste en place, estompée. */
function createGhost(origin: HTMLElement): SVGElement | null {
  const piece = origin.querySelector<SVGElement>(".piece");
  if (piece === null) {
    return null;
  }
  const ghost = piece.cloneNode(true) as SVGElement;
  const size = origin.getBoundingClientRect().width;
  ghost.classList.add("piece-ghost");
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  return ghost;
}

function moveGhost(ghost: SVGElement, event: PointerEvent): void {
  const half = ghost.getBoundingClientRect().width / 2;
  ghost.style.transform = `translate(${event.clientX - half}px, ${event.clientY - half}px)`;
}

function hasMovedEnough(drag: Drag, event: PointerEvent): boolean {
  return Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= DRAG_THRESHOLD;
}

function attachPointer(root: HTMLElement, gestures: BoardGestures): void {
  let drag: Drag | null = null;

  const endDrag = () => {
    drag?.ghost?.remove();
    drag?.origin.classList.remove("is-dragging");
    drag = null;
  };

  root.addEventListener("pointerdown", (event) => {
    const button = squareButton(event.target);
    const square = squareName(button);
    if (button === null || square === null || event.button !== 0) {
      return;
    }
    endDrag();
    if (gestures.press(square)) {
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: button, ghost: null };
      root.setPointerCapture(event.pointerId);
    }
  });

  root.addEventListener("pointermove", (event) => {
    if (drag === null || event.pointerId !== drag.pointerId) {
      return;
    }
    if (drag.ghost === null && hasMovedEnough(drag, event)) {
      drag.ghost = createGhost(drag.origin);
      if (drag.ghost !== null) {
        root.append(drag.ghost);
        drag.origin.classList.add("is-dragging");
      }
    }
    if (drag.ghost !== null) {
      moveGhost(drag.ghost, event);
    }
  });

  root.addEventListener("pointerup", (event) => {
    if (drag === null || event.pointerId !== drag.pointerId) {
      return;
    }
    const wasDragged = drag.ghost !== null;
    endDrag();
    if (wasDragged) {
      const target = squareButton(document.elementFromPoint(event.clientX, event.clientY));
      gestures.drop(target !== null && root.contains(target) ? squareName(target) : null);
    }
  });

  root.addEventListener("pointercancel", endDrag);
}

function attachKeyboard(root: HTMLElement, gestures: BoardGestures): void {
  // Un clic venu du clavier (Entrée, Espace) n'a pas de pointeur : `detail` vaut 0. Les autres sont déjà traités.
  root.addEventListener("click", (event) => {
    const square = squareName(squareButton(event.target));
    if (event.detail === 0 && square !== null) {
      gestures.press(square);
    }
  });

  root.addEventListener("keydown", (event) => {
    const step = ARROW_STEPS[event.key];
    const buttons = [...root.querySelectorAll<HTMLElement>("[data-square]")];
    const currentIndex = buttons.indexOf(squareButton(event.target) ?? root);
    if (step === undefined || currentIndex === -1) {
      return;
    }
    const isRowChange = Math.abs(step) === 1 && Math.floor((currentIndex + step) / BOARD_SIZE) !== Math.floor(currentIndex / BOARD_SIZE);
    const next = isRowChange ? undefined : buttons[currentIndex + step];
    event.preventDefault();
    next?.focus();
  });

  // Une seule case dans l'ordre de tabulation : celle qui a eu le focus en dernier.
  root.addEventListener("focusin", (event) => {
    const focused = squareButton(event.target);
    if (focused !== null) {
      root.querySelectorAll<HTMLElement>("[data-square]").forEach((button) => {
        button.tabIndex = button === focused ? 0 : -1;
      });
    }
  });
}

/** Branche souris, doigt (glisser ou clic-clic) et clavier (flèches, Entrée) sur le plateau. */
export function attachBoardInput(root: HTMLElement, gestures: BoardGestures): void {
  attachPointer(root, gestures);
  attachKeyboard(root, gestures);
}
