import { setText } from "../../shared/dom.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { judgePlayerMove, judgeReply, replay } from "../game/conversion.ts";
import type { ConversionVerdict } from "../game/conversion.ts";
import { describeEvaluation } from "../game/explore.ts";
import { OPPONENT_MOVE_TIME_MS, pickReply } from "../game/opponent.ts";
import type { OpponentLevel } from "../game/opponent.ts";
import type { ConversionDrill, EngineScore } from "../game/types.ts";
import type { BoardView } from "./board.ts";
import type { ConvertElements, ConvertEnd } from "./convertText.ts";
import { describeStep } from "./convertText.ts";
import { playUci } from "./puzzleText.ts";
import type { SoundPlayer } from "./sound.ts";

/** Une partie jouée depuis la position : les coups joués depuis le départ et où l'on en est. */
export interface ConvertGame {
  readonly drill: ConversionDrill;
  readonly moves: string[];
  playerMoves: number;
  hasHint: boolean;
  isOver: boolean;
  isThinking: boolean;
}

/** Le coup du joueur qui a fait tomber l'avantage : montré avec le meilleur coup à la fin. */
export interface Mistake {
  readonly fenBefore: string;
  readonly uci: string;
}

/** Ce dont la partie a besoin pour avancer ; `finish` clôt l'exercice (résultat gardé). */
export interface PlayContext {
  readonly elements: ConvertElements;
  readonly board: BoardView;
  readonly engine: ExploreEngine;
  readonly sound: SoundPlayer;
  readonly random: () => number;
  readonly level: () => OpponentLevel;
  /** Numéro de la dernière demande au moteur : une réponse plus ancienne est ignorée. */
  readonly nextRequest: () => number;
  readonly isCurrent: (requestId: number) => boolean;
  readonly finish: (game: ConvertGame, end: ConvertEnd, mistake: Mistake | null) => void;
  /** Le moteur ne démarre pas : l'exercice s'arrête sans être noté. */
  readonly engineDown: (game: ConvertGame) => void;
}

export function currentFen(game: ConvertGame): string {
  return replay(game.drill.fen, game.moves).fen();
}

/** Plateau de la partie en cours : jouable quand c'est au joueur et que le moteur ne réfléchit pas. */
export function showGame(context: PlayContext, game: ConvertGame): void {
  context.board.show({
    fen: currentFen(game),
    orientation: game.drill.playerColor,
    lastMoveUci: game.moves.at(-1) ?? game.drill.previousMoveUci,
    hintSquare: null,
    isInteractive: !game.isOver && !game.isThinking,
  });
  setText(context.elements.step, describeStep(game.playerMoves));
}

/** Évaluation affichée du côté du joueur ; `isPlayerToMove` dit pour qui le moteur a compté. */
export function showEvaluation(elements: ConvertElements, score: EngineScore, isPlayerToMove: boolean): void {
  const evaluation = describeEvaluation(score, isPlayerToMove);
  setText(elements.evaluation, evaluation.text);
  elements.evalFill.style.width = `${evaluation.winPercent}%`;
}

function endOf(verdict: ConversionVerdict): ConvertEnd | null {
  return verdict.status === "playing" ? null : verdict.reason;
}

/** L'adversaire répond à son niveau ; un mat ou une nulle arrête la partie. */
async function playReply(context: PlayContext, game: ConvertGame, requestId: number): Promise<void> {
  const fen = currentFen(game);
  const level = context.level();
  const lines = await context.engine.search(fen, { depth: level.depth, moveTimeMs: OPPONENT_MOVE_TIME_MS, multiPv: level.multiPv });
  const reply = pickReply(lines, level, context.random());
  if (!context.isCurrent(requestId)) {
    return;
  }
  game.isThinking = false;
  if (reply === null) {
    showGame(context, game);
    return;
  }
  context.sound.play(playUci(fen, reply)?.sound ?? "move");
  game.moves.push(reply);
  const end = endOf(judgeReply(replay(game.drill.fen, game.moves)));
  if (end === null) {
    showGame(context, game);
  } else {
    context.finish(game, end, null);
  }
}

/** Le moteur juge la position après le coup du joueur, à pleine force ; `null` : la partie continue. */
async function judgeMove(context: PlayContext, game: ConvertGame, requestId: number): Promise<ConvertEnd | null> {
  const position = replay(game.drill.fen, game.moves);
  const best = position.isGameOver() ? null : await context.engine.bestLine(position.fen());
  if (best !== null && context.isCurrent(requestId)) {
    showEvaluation(context.elements, best.score, false);
  }
  return endOf(judgePlayerMove(position, best?.score ?? null, game.playerMoves));
}

const MISTAKE_ENDS: ReadonlySet<ConvertEnd> = new Set(["dropped", "notEnough"]);

/** Après un coup du joueur : le moteur juge la position (pleine force), puis l'adversaire répond. */
async function respond(context: PlayContext, game: ConvertGame, mistake: Mistake): Promise<void> {
  const requestId = context.nextRequest();
  game.isThinking = true;
  showGame(context, game);
  setText(context.elements.evaluation, "Le moteur réfléchit…");
  try {
    const end = await judgeMove(context, game, requestId);
    if (!context.isCurrent(requestId)) {
      return;
    }
    if (end === null) {
      await playReply(context, game, requestId);
    } else {
      context.finish(game, end, MISTAKE_ENDS.has(end) ? mistake : null);
    }
  } catch {
    if (context.isCurrent(requestId)) {
      context.engineDown(game);
    }
  }
}

/** Coup joué sur le plateau pendant la partie ; ignoré s'il est illégal ou si le moteur réfléchit. */
export function playPlayerMove(context: PlayContext, game: ConvertGame, uci: string): void {
  if (game.isOver || game.isThinking) {
    return;
  }
  const fenBefore = currentFen(game);
  const played = playUci(fenBefore, uci);
  if (played === null) {
    return;
  }
  context.sound.play(played.sound);
  game.moves.push(uci);
  game.playerMoves += 1;
  void respond(context, game, { fenBefore, uci });
}

/** Indice : le meilleur coup du moteur en flèche. Une réussite avec l'indice ne fait pas progresser la révision. */
export async function showHint(context: PlayContext, game: ConvertGame): Promise<string | null> {
  if (game.isOver || game.isThinking) {
    return null;
  }
  const requestId = context.nextRequest();
  const fen = currentFen(game);
  const best = await context.engine.bestLine(fen);
  if (!context.isCurrent(requestId) || best === null) {
    return null;
  }
  game.hasHint = true;
  context.board.setArrows([{ uci: best.moveUci, tone: "best" }]);
  return playUci(fen, best.moveUci)?.san ?? best.moveUci;
}
