import { UNLOCKS } from "../src/survival/game/balance.ts";
import { playSurvivalBot, type SurvivalBotProfile } from "../tests/survivalBot.ts";

/** Profils joués pour lire la difficulté de Nuit blanche : `npm run simulate:survival`. */
const PROFILES: ReadonlyArray<readonly [string, SurvivalBotProfile]> = [
  ["immobile", { isDodging: false, prefers: "first" }],
  ["esquive, premiere carte", { isDodging: true, prefers: "first" }],
  ["esquive, armes d'abord", { isDodging: true, prefers: "weapon" }],
  ["esquive, passifs d'abord", { isDodging: true, prefers: "passive" }],
];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const ALL_UNLOCKS = UNLOCKS.map((unlock) => unlock.id);

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

for (const [label, profile] of PROFILES) {
  for (const unlocked of [[], ALL_UNLOCKS]) {
    const started = performance.now();
    const results = SEEDS.map((seed) => playSurvivalBot(seed, profile, unlocked));
    const wins = results.filter((result) => result.hasWon).length;
    const times = results.map((result) => formatTime(result.seconds)).join(" ");
    const levels = results.map((result) => result.level).join(" ");
    const scores = results.map((result) => result.score).join(" ");
    const peak = Math.max(...results.map((result) => result.peakEnemies));
    const coins = results.map((result) => result.coins).join(" ");
    const tag = unlocked.length === 0 ? "base" : "tout debloque";
    console.log(`${label} (${tag}) : ${wins}/${SEEDS.length} nuits gagnees, pic ${peak} ennemis, ${Math.round(performance.now() - started)} ms`);
    console.log(`  temps   ${times}\n  niveaux ${levels}\n  scores  ${scores}\n  pieces  ${coins}`);
  }
}
