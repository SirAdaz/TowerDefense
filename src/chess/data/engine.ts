// Stockfish (GPL-3.0) tourne à part, dans son propre Web Worker, et ne reçoit que du texte UCI :
// ses deux fichiers sont servis tels quels, sans être liés au code de la page.
import engineScriptUrl from "stockfish/bin/stockfish-19-lite-single.js?url";
import engineWasmUrl from "stockfish/bin/stockfish-19-lite-single.wasm?url";
import type { EngineLine } from "../game/types.ts";
import { collectLines, isBestMoveLine, parseInfoLine } from "../game/uci.ts";
import type { InfoLine } from "../game/uci.ts";

/** Limites d'une recherche : elle s'arrête à la première atteinte, profondeur ou durée. */
export interface SearchLimits {
  readonly depth: number;
  readonly moveTimeMs: number;
  readonly multiPv: number;
  /** Restreint la recherche à ces coups (UCI) : sert à évaluer le coup joué dans la partie. */
  readonly searchMoves?: readonly string[];
}

export interface Engine {
  /** Meilleures variantes de la position, la meilleure en premier. Une seule recherche à la fois. */
  analyse(fen: string, limits: SearchLimits): Promise<EngineLine[]>;
  /** Vide la mémoire du moteur entre deux parties : les évaluations ne dépendent pas de l'ordre. */
  newGame(): void;
  /** Arrête le moteur tout de suite ; la recherche en cours est rejetée avec une `AbortError`. */
  dispose(): void;
}

interface PendingSearch {
  readonly infoLines: InfoLine[];
  readonly resolve: (lines: EngineLine[]) => void;
  readonly reject: (reason: Error) => void;
}

/** Délai laissé au moteur pour se charger (1,8 Mo à télécharger et compiler) avant d'abandonner. */
const STARTUP_TIMEOUT_MS = 30_000;

function abortError(): DOMException {
  return new DOMException("Engine stopped", "AbortError");
}

function goCommand(limits: SearchLimits): string {
  const restriction = limits.searchMoves === undefined ? "" : ` searchmoves ${limits.searchMoves.join(" ")}`;
  return `go depth ${limits.depth} movetime ${limits.moveTimeMs}${restriction}`;
}

/** Attend que le moteur réponde `readyok`, ou échoue s'il ne démarre pas (script ou WebAssembly bloqué). */
function waitUntilReady(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Engine did not start in time"));
    }, STARTUP_TIMEOUT_MS);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.data === "readyok") {
        clearTimeout(timeoutId);
        worker.removeEventListener("message", onMessage);
        resolve();
      }
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", () => {
      clearTimeout(timeoutId);
      reject(new Error("Engine failed to load"));
    });
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
}

function createEngine(worker: Worker): Engine {
  let pending: PendingSearch | null = null;
  let currentMultiPv = 1;

  worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (pending === null || typeof event.data !== "string") {
      return;
    }
    const infoLine = parseInfoLine(event.data);
    if (infoLine !== null) {
      pending.infoLines.push(infoLine);
    } else if (isBestMoveLine(event.data)) {
      const finished = pending;
      pending = null;
      finished.resolve(collectLines(finished.infoLines));
    }
  });

  return {
    analyse: (fen, limits) =>
      new Promise<EngineLine[]>((resolve, reject) => {
        if (pending !== null) {
          reject(new Error("Engine is already searching"));
          return;
        }
        pending = { infoLines: [], resolve, reject };
        if (limits.multiPv !== currentMultiPv) {
          currentMultiPv = limits.multiPv;
          worker.postMessage(`setoption name MultiPV value ${limits.multiPv}`);
        }
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(goCommand(limits));
      }),
    newGame: () => {
      worker.postMessage("ucinewgame");
    },
    dispose: () => {
      worker.terminate();
      pending?.reject(abortError());
      pending = null;
    },
  };
}

/**
 * Démarre un moteur. L'adresse du fichier WebAssembly passe dans le fragment de celle du script :
 * c'est là que Stockfish.js la lit, le build renommant les deux fichiers avec leur empreinte.
 */
export async function startEngine(): Promise<Engine> {
  const worker = new Worker(`${engineScriptUrl}#${encodeURIComponent(engineWasmUrl)}`);
  try {
    await waitUntilReady(worker);
  } catch (error) {
    worker.terminate();
    throw error;
  }
  return createEngine(worker);
}
