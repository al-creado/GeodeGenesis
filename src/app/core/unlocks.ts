import { GAME_CONFIG, GameConfig, Rarity } from './config';
import { isAtLeast } from './odds';
import { Collection } from './pull';
import { GemDef } from './roster';

export interface Unlocks {
  readonly vault: boolean;
  readonly daily: boolean;
  readonly crew: boolean;
  readonly shop: boolean;
  readonly pity: boolean;
}

/** The rarest rarity in a collection, or null when it is empty. */
export function bestRarity(collection: Collection, roster: readonly GemDef[]): Rarity | null {
  let best: Rarity | null = null;
  for (const g of roster) {
    if (collection[g.id] && (best === null || isAtLeast(g.rarity, best))) best = g.rarity;
  }
  return best;
}

/** What a player has unlocked so far. Derived from progress, so it never needs saving. */
export function computeUnlocks(
  totalPulls: number,
  best: Rarity | null,
  config: GameConfig = GAME_CONFIG,
): Unlocks {
  const u = config.unlocks;
  return {
    vault: totalPulls >= u.vaultAfterPulls,
    daily: totalPulls >= u.dailyAfterPulls,
    crew: best !== null && isAtLeast(best, u.crewAfterRarity),
    shop: totalPulls >= u.shopAfterPulls,
    pity: totalPulls >= u.pityAfterPulls,
  };
}
