// Mesure de l'équilibrage : fait jouer des joueurs automatiques et affiche la vague atteinte.
// Usage (dans le conteneur) : node scripts/simulate.ts
import { playGame } from "../tests/bot.ts";

const PROFILES = [
  { label: "2 tourelles, jamais améliorées", maxTowers: 2, canUpgrade: false },
  { label: "pose seulement, 12 tourelles max", maxTowers: 12, canUpgrade: false },
  { label: "6 tourelles + améliorations", maxTowers: 6, canUpgrade: true },
  { label: "12 tourelles + améliorations", maxTowers: 12, canUpgrade: true },
  { label: "30 tourelles + améliorations", maxTowers: 30, canUpgrade: true },
];

for (const profile of PROFILES) {
  const result = playGame({ ...profile, maxWave: 60 });
  const leaks = result.livesLostByWave
    .map((lost, wave) => (lost ? `v${wave}:-${lost}` : ""))
    .filter(Boolean)
    .join(" ");
  console.log(`${profile.label.padEnd(36)} vague ${String(result.waveReached).padStart(2)}  ${leaks}`);
}
