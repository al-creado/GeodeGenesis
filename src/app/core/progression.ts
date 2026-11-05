import { GAME_CONFIG, GameConfig, MilestoneDef, RARITIES, Rarity, Reward } from './config';
import type { Collection } from './pull';
import { GemDef, gemsOfRarity } from './roster';

/** A crew member's luck: base luck for its rarity, plus a share of that base for each level above 1. */
export function gemLuck(rarity: Rarity, level: number, config: GameConfig = GAME_CONFIG): number {
  return config.luckPerGem[rarity] * (1 + config.progression.levelLuckFactor * (Math.max(level, 1) - 1));
}

export interface CrewMember {
  readonly rarity: Rarity;
  readonly level: number;
}

/** The crew's gems with their levels (unknown or unowned ids are ignored). */
export function crewMembers(crew: readonly string[], collection: Collection, roster: readonly GemDef[]): CrewMember[] {
  return crew.flatMap((id) => {
    const gem = roster.find((g) => g.id === id);
    const owned = collection[id];
    return gem && owned ? [{ rarity: gem.rarity, level: owned.level }] : [];
  });
}

export interface MilestoneState {
  readonly def: MilestoneDef;
  readonly reached: boolean;
  readonly claimed: boolean;
}

export function milestoneStates(ownedCount: number, claimed: readonly number[], config: GameConfig = GAME_CONFIG): MilestoneState[] {
  return config.progression.milestones.map((def) => ({
    def,
    reached: ownedCount >= def.count,
    claimed: claimed.includes(def.count),
  }));
}

/** Claim a reached milestone. Returns null if it is unknown, not reached, or already claimed. */
export function claimMilestone(
  ownedCount: number,
  claimed: readonly number[],
  count: number,
  config: GameConfig = GAME_CONFIG,
): { claimed: number[]; reward: Reward } | null {
  const m = milestoneStates(ownedCount, claimed, config).find((s) => s.def.count === count);
  if (!m || !m.reached || m.claimed) return null;
  return { claimed: [...claimed, count], reward: m.def.reward };
}

export interface SetState {
  readonly rarity: Rarity;
  readonly owned: number;
  readonly total: number;
  readonly complete: boolean;
  readonly bonus: number;
}

export function setStates(collection: Collection, roster: readonly GemDef[], config: GameConfig = GAME_CONFIG): SetState[] {
  return RARITIES.map((rarity) => {
    const gems = gemsOfRarity(roster, rarity);
    const owned = gems.filter((g) => collection[g.id]).length;
    return { rarity, owned, total: gems.length, complete: gems.length > 0 && owned === gems.length, bonus: config.progression.setBonuses[rarity] };
  });
}

export interface PermanentLuck {
  readonly sets: number;
  readonly milestones: number;
  readonly total: number;
}

/** Luck that comes from collecting (completed sets and claimed milestones), before the cap. */
export function permanentLuck(
  collection: Collection,
  claimedMilestones: readonly number[],
  roster: readonly GemDef[],
  config: GameConfig = GAME_CONFIG,
): PermanentLuck {
  const sets = setStates(collection, roster, config).reduce((a, s) => a + (s.complete ? s.bonus : 0), 0);
  const milestones = config.progression.milestones
    .filter((m) => claimedMilestones.includes(m.count))
    .reduce((a, m) => a + (m.reward.luck ?? 0), 0);
  return { sets, milestones, total: sets + milestones };
}
