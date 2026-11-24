import { playBot, type BotProfile } from "../tests/bot.ts";

/** Profils joués pour lire la courbe de difficulté : `npm run simulate`. */
const PROFILES: ReadonlyArray<readonly [string, BotProfile]> = [
  ["aucune tourelle", { maxTowers: 0, shouldUpgrade: false, shouldRush: false }],
  ["3 tourelles, sans amelioration", { maxTowers: 3, shouldUpgrade: false, shouldRush: false }],
  ["pose seulement, 12 tourelles", { maxTowers: 12, shouldUpgrade: false, shouldRush: false }],
  ["4 tourelles + ameliorations", { maxTowers: 4, shouldUpgrade: true, shouldRush: false }],
  ["8 tourelles + ameliorations", { maxTowers: 8, shouldUpgrade: true, shouldRush: false }],
  ["8 tourelles + ameliorations, vagues en avance", { maxTowers: 8, shouldUpgrade: true, shouldRush: true }],
  ["16 tourelles + ameliorations", { maxTowers: 16, shouldUpgrade: true, shouldRush: false }],
  ["30 tourelles + ameliorations", { maxTowers: 30, shouldUpgrade: true, shouldRush: false }],
  ["pose seulement, 124 tourelles", { maxTowers: 124, shouldUpgrade: false, shouldRush: false }],
];

for (const [label, profile] of PROFILES) {
  const result = playBot(profile, 80);
  const firstLoss = result.firstLossWave === null ? "aucune" : `vague ${result.firstLossWave}`;
  console.log(`${label.padEnd(48)} vague atteinte ${String(result.waveReached).padStart(2)} | 1re vie perdue : ${firstLoss}`);
}
