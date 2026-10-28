import { GAME_CONFIG, GameConfig, Rarity } from './config';
import { Collection } from './pull';
import { findGem, GemDef } from './roster';

export type CrewResult = { ok: true; crew: readonly string[] } | { ok: false; reason: 'notOwned' | 'full' | 'duplicate' | 'notInCrew' };

export function addToCrew(crew: readonly string[], gemId: string, slots: number, collection: Collection): CrewResult {
  if (!collection[gemId]) return { ok: false, reason: 'notOwned' };
  if (crew.includes(gemId)) return { ok: false, reason: 'duplicate' };
  if (crew.length >= slots) return { ok: false, reason: 'full' };
  return { ok: true, crew: [...crew, gemId] };
}

export function removeFromCrew(crew: readonly string[], gemId: string): CrewResult {
  if (!crew.includes(gemId)) return { ok: false, reason: 'notInCrew' };
  return { ok: true, crew: crew.filter((id) => id !== gemId) };
}

/** Rarities of the crew's gems (unknown ids are ignored). */
export function crewRarities(crew: readonly string[], roster: readonly GemDef[]): Rarity[] {
  return crew.flatMap((id) => {
    const gem = findGem(roster, id);
    return gem ? [gem.rarity] : [];
  });
}

/** Shard cost of the next slot unlock, or null when all slots are unlocked. */
export function nextSlotCost(slots: number, config: GameConfig = GAME_CONFIG): number | null {
  if (slots >= config.crew.maxSlots) return null;
  return config.crew.slotUnlockShards[slots - config.crew.startSlots] ?? null;
}

export function unlockSlot(
  slots: number,
  shards: number,
  config: GameConfig = GAME_CONFIG,
): { slots: number; shards: number } | null {
  const cost = nextSlotCost(slots, config);
  if (cost === null || shards < cost) return null;
  return { slots: slots + 1, shards: shards - cost };
}
