import { HEAL_CHOICE_HP, PASSIVES, WEAPONS } from "../game/balance.ts";
import type { UpgradeChoice, UpgradeId, WeaponId } from "../game/types.ts";

/** Ce qu'une carte d'amélioration affiche. */
export interface ChoiceCard {
  readonly tag: string;
  readonly name: string;
  readonly text: string;
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
