import { UNLOCKS } from "../src/survival/game/balance.ts";
import { playSurvivalBot, type SurvivalBotProfile, type SurvivalBotResult } from "../tests/survivalBot.ts";

/** Profils joués pour lire la difficulté de Nuit blanche : `npm run simulate:survival` (tableau Markdown). */
const PROFILES: ReadonlyArray<readonly [string, SurvivalBotProfile, boolean]> = [
  ["immobile", { moves: "still", prefers: "first" }, false],
  ["débutant (cercle, 1re carte)", { moves: "circle", prefers: "first" }, false],
  ["fuite, armes d'abord", { moves: "flee", prefers: "weapon" }, false],
  ["esquive, armes d'abord", { moves: "dodge", prefers: "weapon" }, false],
  ["esquive, passifs d'abord", { moves: "dodge", prefers: "passive" }, false],
  ["esquive, armes, tout débloqué", { moves: "dodge", prefers: "weapon" }, true],
];
const SEED_COUNT = 30;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, index) => index + 1);
const ALL_UNLOCKS = UNLOCKS.map((unlock) => unlock.id);

function formatTime(seconds: number | undefined): string {
  if (seconds === undefined) {
    return "—";
  }
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function quantile(values: readonly number[], ratio: number): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

/** Seconde où le niveau est atteint (ou dépassé d'un coup) ; absent s'il ne l'est jamais. */
function reachedAt(result: SurvivalBotResult, level: number): number | undefined {
  return result.levelTimes.slice(level).find((seconds) => seconds !== undefined);
}

/** Médiane des temps d'atteinte d'un niveau, sur les parties qui l'atteignent ; « (k/n) » si toutes ne l'atteignent pas. */
function levelColumn(results: readonly SurvivalBotResult[], level: number): string {
  const times = results.map((result) => reachedAt(result, level)).filter((seconds) => seconds !== undefined);
  const share = times.length === results.length ? "" : ` (${times.length}/${results.length})`;
  return `${formatTime(quantile(times, 0.5))}${share}`;
}

console.log(`${SEEDS.length} graines par profil\n`);
console.log("| Profil | Survie médiane | p25 – p75 | Aubes vues | Niv. 2 | Niv. 5 | Niv. 10 | Niveau final |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const [label, profile, isAllUnlocked] of PROFILES) {
  const results = SEEDS.map((seed) => playSurvivalBot(seed, profile, isAllUnlocked ? ALL_UNLOCKS : []));
  const seconds = results.map((result) => result.seconds);
  const wins = results.filter((result) => result.hasWon).length;
  const spread = `${formatTime(quantile(seconds, 0.25))} – ${formatTime(quantile(seconds, 0.75))}`;
  const finalLevel = quantile(
    results.map((result) => result.level),
    0.5,
  );
  const columns = [label, formatTime(quantile(seconds, 0.5)), spread, `${wins}/${results.length}`];
  columns.push(levelColumn(results, 2), levelColumn(results, 5), levelColumn(results, 10), String(finalLevel));
  console.log(`| ${columns.join(" | ")} |`);
}
