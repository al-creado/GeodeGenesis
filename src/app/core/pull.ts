import { GAME_CONFIG, GameConfig, RARITIES, Rarity } from './config';
import { adjustedOdds, isAtLeast, OddsTable } from './odds';
import { GemDef, gemsOfRarity } from './roster';
import { Rng } from './rng';

/** Cracks since the last Emerald+ / Ruby+ drop. */
export interface PityState {
  readonly sinceEmerald: number;
  readonly sinceRuby: number;
}

export const INITIAL_PITY: PityState = { sinceEmerald: 0, sinceRuby: 0 };

export type PityTrigger = 'emerald' | 'ruby' | null;

/** Collection entry: owned gems and their level. */
export type Collection = Readonly<Record<string, { readonly level: number }>>;

export type DuplicateOutcome = 'new' | 'levelUp' | 'shards';

export interface CrackResult {
  readonly gem: GemDef;
  readonly outcome: DuplicateOutcome;
  /** Level after this crack (max level when converted to shards). */
  readonly level: number;
  readonly shardsGained: number;
  /** Which pity guarantee (if any) forced the rarity. */
  readonly pityTrigger: PityTrigger;
}

export interface BatchResult {
  readonly results: readonly CrackResult[];
  readonly collection: Collection;
  readonly pity: PityState;
  readonly shardsGained: number;
}

/** Pick a rarity from an odds table, optionally limited to a minimum tier. */
export function rollRarity(odds: OddsTable, rng: Rng, min: Rarity = 'quartz'): Rarity {
  const eligible = RARITIES.filter((r) => isAtLeast(r, min));
  const total = eligible.reduce((acc, r) => acc + odds[r], 0);
  const target = rng.next() * total;
  let acc = 0;
  for (const r of eligible) {
    acc += odds[r];
    if (target < acc) return r;
  }
  return eligible[eligible.length - 1];
}

/** Which pity guarantee fires on the *next* crack. Ruby takes priority. */
export function pendingPity(pity: PityState, config: GameConfig = GAME_CONFIG): PityTrigger {
  if (pity.sinceRuby + 1 >= config.pity.rubyOrBetter) return 'ruby';
  if (pity.sinceEmerald + 1 >= config.pity.emeraldOrBetter) return 'emerald';
  return null;
}

export function advancePity(
  pity: PityState,
  rarity: Rarity,
): PityState {
  return {
    sinceEmerald: isAtLeast(rarity, 'emerald') ? 0 : pity.sinceEmerald + 1,
    sinceRuby: isAtLeast(rarity, 'ruby') ? 0 : pity.sinceRuby + 1,
  };
}

/** Roll one gem's rarity with pity applied. Does not touch the collection. */
export function rollGemRarity(
  pity: PityState,
  luck: number,
  rng: Rng,
  config: GameConfig = GAME_CONFIG,
): { rarity: Rarity; pityTrigger: PityTrigger } {
  const odds = adjustedOdds(luck, config);
  const trigger = pendingPity(pity, config);
  const min: Rarity = trigger === 'ruby' ? 'ruby' : trigger === 'emerald' ? 'emerald' : 'quartz';
  return { rarity: rollRarity(odds, rng, min), pityTrigger: trigger };
}

/** Apply a pulled gem to the collection: new, level up, or shards at max. */
export function applyDuplicate(
  collection: Collection,
  gem: GemDef,
  config: GameConfig = GAME_CONFIG,
): { collection: Collection; outcome: DuplicateOutcome; level: number; shardsGained: number } {
  const owned = collection[gem.id];
  if (!owned) {
    return { collection: { ...collection, [gem.id]: { level: 1 } }, outcome: 'new', level: 1, shardsGained: 0 };
  }
  const max = config.duplicates.maxLevel;
  if (owned.level >= max) {
    return {
      collection,
      outcome: 'shards',
      level: owned.level,
      shardsGained: config.duplicates.shardsPerDuplicate[gem.rarity],
    };
  }
  const level = owned.level + 1;
  return { collection: { ...collection, [gem.id]: { level } }, outcome: 'levelUp', level, shardsGained: 0 };
}

/** Crack `count` geodes in sequence. Pure: returns new state, never mutates. */
export function crack(
  count: number,
  state: { collection: Collection; pity: PityState },
  luck: number,
  rng: Rng,
  roster: readonly GemDef[],
  config: GameConfig = GAME_CONFIG,
): BatchResult {
  let { collection, pity } = state;
  const results: CrackResult[] = [];
  let shardsGained = 0;
  for (let i = 0; i < count; i++) {
    const { rarity, pityTrigger } = rollGemRarity(pity, luck, rng, config);
    const pool = gemsOfRarity(roster, rarity);
    if (pool.length === 0) throw new Error(`Roster has no ${rarity} gems`);
    const gem = pool[Math.floor(rng.next() * pool.length)];
    const applied = applyDuplicate(collection, gem, config);
    collection = applied.collection;
    pity = advancePity(pity, rarity);
    shardsGained += applied.shardsGained;
    results.push({
      gem,
      outcome: applied.outcome,
      level: applied.level,
      shardsGained: applied.shardsGained,
      pityTrigger,
    });
  }
  return { results, collection, pity, shardsGained };
}
