import { HEAL_CHOICE_HP, PASSIVES, RUN_SECONDS, WEAPONS } from "../game/balance.ts";
import type { Profile } from "../game/profile.ts";
import type { UpgradeChoice, UpgradeId, WeaponId } from "../game/types.ts";

/** Ce qu'une carte d'amélioration affiche. */
export interface ChoiceCard {
  readonly tag: string;
  readonly name: string;
  readonly text: string;
}

const numberFormat = new Intl.NumberFormat("fr-FR");

/** Nombre avec séparateur de milliers français. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Durée en minutes:secondes. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatCoins(coins: number): string {
  return `${formatNumber(coins)} ${coins > 1 ? "pièces" : "pièce"}`;
}

function isWeapon(id: UpgradeId): id is WeaponId {
  return id in WEAPONS;
}

/** Nom, genre et description d'une arme ou d'un passif à débloquer. */
export function describeUpgrade(id: UpgradeId): ChoiceCard {
  if (isWeapon(id)) {
    return { tag: "Arme", name: WEAPONS[id].name, text: WEAPONS[id].levels[0]?.text ?? "" };
  }
  return { tag: "Passif", name: PASSIVES[id].name, text: PASSIVES[id].text };
}

/** Texte d'une carte proposée au passage de niveau. */
export function describeChoice(choice: UpgradeChoice): ChoiceCard {
  if (choice.kind === "heal") {
    return { tag: "Soin", name: "Second souffle", text: `Rend ${HEAL_CHOICE_HP} points de vie.` };
  }
  const levelTag = choice.level === 1 ? "nouveau" : `niveau ${choice.level}`;
  if (choice.kind === "weapon") {
    const weapon = WEAPONS[choice.id];
    return { tag: `Arme · ${levelTag}`, name: weapon.name, text: weapon.levels[choice.level - 1]?.text ?? "" };
  }
  const passive = PASSIVES[choice.id];
  return { tag: `Passif · ${levelTag}`, name: passive.name, text: passive.text };
}

/** Record du joueur en une ligne (menu du jeu et carte de l'accueil), ou `null` s'il n'a jamais joué. */
export function describeRecord(profile: Profile): string | null {
  if (profile.bestScore <= 0) {
    return null;
  }
  const night = profile.hasWon ? "aube atteinte" : `tenu ${formatTime(Math.min(profile.bestSeconds, RUN_SECONDS))}`;
  return `Record : ${formatNumber(profile.bestScore)} points · ${night}`;
}
