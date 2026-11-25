import { MAX_SOLUTIONS, buildPuzzle, reviewGame, terminalScore, unusableGame } from "../game/analysis.ts";
import { MIN_PLIES } from "../game/chesscom.ts";
import { parseGame } from "../game/pgn.ts";
import type { AnalysedGame, EngineScore, ParsedGame, Puzzle, PuzzleCandidate, RawGame } from "../game/types.ts";
import type { Engine, SearchLimits } from "./engine.ts";
import type { ChessStore } from "./store.ts";

/**
 * Première passe, sur chaque position : profondeur 14, ou 0,4 s sur un appareil lent. Assez pour
 * repérer une perte de deux pions, et une partie de 40 coups reste sous la minute sur téléphone.
 */
export const QUICK_SEARCH: SearchLimits = { depth: 14, moveTimeMs: 400, multiPv: 1 };

/** Seconde passe, sur les seules positions candidates : plus profonde, avec les coups concurrents. */
export const DEEP_SEARCH: SearchLimits = { depth: 18, moveTimeMs: 1500, multiPv: MAX_SOLUTIONS + 1 };

/** Moteurs en parallèle, un par partie : au plus quatre, et la moitié des cœurs pour laisser la page fluide. */
const MAX_ENGINES = 4;

export interface AnalysisProgress {
  readonly doneGames: number;
  readonly totalGames: number;
  readonly donePositions: number;
  readonly totalPositions: number;
}

export interface AnalysisResult {
  readonly games: readonly AnalysedGame[];
  readonly puzzles: readonly Puzzle[];
}

export interface AnalysisOptions {
  readonly username: string;
  readonly store: ChessStore;
  readonly signal: AbortSignal;
  readonly startEngine: () => Promise<Engine>;
  readonly onProgress: (progress: AnalysisProgress) => void;
}

interface Job {
  readonly game: RawGame;
  readonly parsed: ParsedGame;
}

interface Run {
  readonly options: AnalysisOptions;
  readonly queue: Job[];
  readonly games: AnalysedGame[];
  readonly puzzles: Puzzle[];
  readonly totalGames: number;
  readonly totalPositions: number;
  donePositions: number;
}

/** Nombre de moteurs à lancer ; `hardwareThreads` peut manquer sur certains navigateurs. */
export function engineCount(hardwareThreads: number | undefined, jobCount: number): number {
  const byThreads = Math.floor((hardwareThreads ?? 2) / 2);
  return Math.max(1, Math.min(MAX_ENGINES, byThreads, jobCount));
}

function toJob(game: RawGame): Job | null {
  const parsed = parseGame(game.pgn);
  return parsed !== null && parsed.moves.length >= MIN_PLIES ? { game, parsed } : null;
}

/** Démarre les moteurs l'un après l'autre : si l'un échoue, ceux déjà lancés sont connus et arrêtés. */
async function startEngines(engines: Engine[], wantedCount: number, options: AnalysisOptions): Promise<void> {
  while (engines.length < wantedCount) {
    engines.push(await options.startEngine());
    options.signal.throwIfAborted();
  }
}

function report(run: Run): void {
  run.options.onProgress({
    doneGames: run.games.length,
    totalGames: run.totalGames,
    donePositions: run.donePositions,
    totalPositions: run.totalPositions,
  });
}

async function scorePosition(engine: Engine, fen: string, isFinal: boolean): Promise<EngineScore> {
  const finalScore = isFinal ? terminalScore(fen) : null;
  if (finalScore !== null) {
    return finalScore;
  }
  const lines = await engine.analyse(fen, QUICK_SEARCH);
  return lines[0]?.score ?? { kind: "cp", value: 0 };
}

async function scoreGame(engine: Engine, parsed: ParsedGame, run: Run): Promise<EngineScore[]> {
  const fens = [...parsed.moves.map((move) => move.fenBefore), parsed.finalFen];
  const scores: EngineScore[] = [];
  for (const [index, fen] of fens.entries()) {
    run.options.signal.throwIfAborted();
    scores.push(await scorePosition(engine, fen, index === fens.length - 1));
    run.donePositions += 1;
    report(run);
  }
  return scores;
}

async function toPuzzle(engine: Engine, game: AnalysedGame, candidate: PuzzleCandidate): Promise<Puzzle | null> {
  const lines = await engine.analyse(candidate.fen, DEEP_SEARCH);
  const playedLines = await engine.analyse(candidate.fen, { ...DEEP_SEARCH, searchMoves: [candidate.playedUci] });
  return buildPuzzle(game, candidate, { lines, playedScore: playedLines[0]?.score ?? null });
}

async function analyseJob(engine: Engine, job: Job, run: Run): Promise<void> {
  const { store, username, signal } = run.options;
  engine.newGame();
  const scores = await scoreGame(engine, job.parsed, run);
  const review = reviewGame(job.game, job.parsed, scores, username);
  for (const candidate of review.candidates) {
    signal.throwIfAborted();
    const puzzle = await toPuzzle(engine, review.analysed, candidate);
    if (puzzle !== null) {
      await store.savePuzzle(puzzle);
      run.puzzles.push(puzzle);
    }
  }
  // La partie n'est notée qu'une fois ses problèmes gardés : interrompue avant, elle sera refaite en entier.
  await store.saveGame(review.analysed);
  run.games.push(review.analysed);
  report(run);
}

async function drainQueue(engine: Engine, run: Run): Promise<void> {
  for (let job = run.queue.shift(); job !== undefined; job = run.queue.shift()) {
    await analyseJob(engine, job, run);
  }
}

/**
 * Analyse des parties sur l'appareil, plusieurs moteurs en parallèle, de la plus ancienne à la plus
 * récente. Chaque partie est gardée dès qu'elle est finie : une annulation (`AbortError`) ne perd que
 * celles en cours.
 */
export async function analyseGames(rawGames: readonly RawGame[], options: AnalysisOptions): Promise<AnalysisResult> {
  const jobs: Job[] = [];
  for (const game of [...rawGames].reverse()) {
    const job = toJob(game);
    if (job === null) {
      // Illisible ou trop courte : notée quand même, sinon elle reviendrait à chaque passe.
      await options.store.saveGame(unusableGame(game, options.username));
    } else {
      jobs.push(job);
    }
  }
  const run: Run = {
    options,
    queue: [...jobs],
    games: [],
    puzzles: [],
    totalGames: jobs.length,
    totalPositions: jobs.reduce((total, job) => total + job.parsed.moves.length + 1, 0),
    donePositions: 0,
  };
  report(run);
  const engines: Engine[] = [];
  const disposeAll = () => {
    engines.forEach((engine) => {
      engine.dispose();
    });
  };
  options.signal.addEventListener("abort", disposeAll);
  try {
    await startEngines(engines, jobs.length === 0 ? 0 : engineCount(navigator.hardwareConcurrency, jobs.length), options);
    await Promise.all(engines.map((engine) => drainQueue(engine, run)));
  } finally {
    options.signal.removeEventListener("abort", disposeAll);
    disposeAll();
  }
  return { games: run.games, puzzles: run.puzzles };
}
