import {
  CHOICE_COUNT,
  HEAL_CHOICE_HP,
  MAX_PASSIVE_LEVEL,
  MAX_WEAPON_LEVEL,
  PASSIVE_BONUS,
  PASSIVE_IDS,
  UNLOCKS,
  WEAPON_IDS,
} from "./balance.ts";
import { recomputeStats } from "./player.ts";
import { nextIndex } from "./rng.ts";
import type { GameState, UpgradeChoice, UpgradeId } from "./types.ts";

const HEAL_CHOICE: UpgradeChoice = { kind: "heal", id: "heal", level: 0 };

/** Une arme ou un passif est dans le tirage s'il est de base, ou débloqué entre les parties. */
export function isInDraw(unlocked: readonly UpgradeId[], id: UpgradeId): boolean {
  const isLockedByDefault = UNLOCKS.some((unlock) => unlock.id === id);
  return !isLockedByDefault || unlocked.includes(id);
}

/** Tout ce qui peut encore être proposé : armes et passifs du tirage qui n'ont pas atteint leur maximum. */
export function availableChoices(state: GameState): UpgradeChoice[] {
  const choices: UpgradeChoice[] = [];
  for (const id of WEAPON_IDS) {
    const level = state.weapons[id].level;
    if (level < MAX_WEAPON_LEVEL && isInDraw(state.unlocked, id)) {
      choices.push({ kind: "weapon", id, level: level + 1 });
    }
  }
  for (const id of PASSIVE_IDS) {
    const level = state.passives[id];
    if (level < MAX_PASSIVE_LEVEL && isInDraw(state.unlocked, id)) {
      choices.push({ kind: "passive", id, level: level + 1 });
    }
  }
  return choices;
}

/** Tire les cartes d'un passage de niveau, sans doublon. Un soin complète quand le tirage s'épuise. */
export function rollChoices(state: GameState): UpgradeChoice[] {
  const remaining = availableChoices(state);
  const picked: UpgradeChoice[] = [];
  while (picked.length < CHOICE_COUNT && remaining.length > 0) {
    picked.push(...remaining.splice(nextIndex(state, remaining.length), 1));
  }
  if (picked.length < CHOICE_COUNT) {
    picked.push(HEAL_CHOICE);
  }
  return picked;
}

function applyChoice(state: GameState, choice: UpgradeChoice): void {
  const { player } = state;
  if (choice.kind === "weapon") {
    state.weapons[choice.id].level = choice.level;
    state.weapons[choice.id].cooldown = 0;
  } else if (choice.kind === "passive") {
    state.passives[choice.id] = choice.level;
    recomputeStats(state);
    player.hp += choice.id === "vigor" ? PASSIVE_BONUS.vigorHp : 0;
  } else {
    player.hp += HEAL_CHOICE_HP;
  }
  player.hp = Math.min(player.hp, state.stats.maxHp);
}

/** Met la partie en attente d'un choix si un niveau a été franchi. */
export function openLevelUp(state: GameState): void {
  if (state.phase === "playing" && state.pendingLevelUps > 0) {
    state.choices = rollChoices(state);
    state.phase = "levelUp";
  }
}

/**
 * Applique la carte choisie. S'il reste des niveaux en attente (plusieurs franchis d'un coup), un
 * nouveau tirage suit ; sinon la partie reprend. Renvoie `false` si le choix n'existe pas.
 */
export function chooseUpgrade(state: GameState, choiceIndex: number): boolean {
  const choice = state.choices[choiceIndex];
  if (state.phase !== "levelUp" || choice === undefined) {
    return false;
  }
  applyChoice(state, choice);
  state.pendingLevelUps -= 1;
  state.choices = [];
  state.phase = "playing";
  openLevelUp(state);
  return true;
}
