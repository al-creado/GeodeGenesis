import { GAME_CONFIG, GameConfig, RARITIES } from './config';
import { computeLuck } from './odds';
import { claimDaily, DailyState, idleAccrued, INITIAL_DAILY, applyMultiplier, postCrackBonus } from './economy';
import { Collection, crack, INITIAL_PITY, PityState } from './pull';
import { nextSlotCost, unlockSlot } from './crew';
import { createSeededRng } from './rng';
import { GemDef, ROSTER } from './roster';

/** How a simulated player behaves. */
export interface PlayerProfile {
  readonly name: string;
  /** Times per day the player opens the game to collect idle coins (evenly spaced). */
  readonly collectsPerDay: number;
  /** Watches a rewarded ad for every x2 offer (idle, daily, post-crack). */
  readonly watchAds: boolean;
}

export const PROFILES: readonly PlayerProfile[] = [
  { name: 'Casual (1 visit/day, no ads)', collectsPerDay: 1, watchAds: false },
  { name: 'Regular (3 visits/day, ads)', collectsPerDay: 3, watchAds: true },
  { name: 'Dedicated (6 visits/day, ads)', collectsPerDay: 6, watchAds: true },
];

export interface SimResult {
  /** First day (1-based) the player owned at least n distinct gems; index = n. */
  readonly dayOwned: readonly (number | null)[];
  /** First day each rarity was found. */
  readonly dayFirst: Readonly<Record<string, number | null>>;
  readonly totalCracks: number;
  readonly ownedAtEnd: number;
  readonly daysSimulated: number;
}

/** Best crew from owned gems: highest luck first (ties broken by id for determinism). */
function bestCrew(collection: Collection, slots: number, config: GameConfig): string[] {
  return ROSTER.filter((g) => collection[g.id])
    .sort((a, b) => config.luckPerGem[b.rarity] - config.luckPerGem[a.rarity] || a.id.localeCompare(b.id))
    .slice(0, slots)
    .map((g) => g.id);
}

/**
 * Play the game for `days` days with a fixed strategy and report when milestones happen.
 * Strategy: collect idle coins on schedule, claim the daily bonus on the first visit of the
 * day, spend every coin (x10 when affordable), keep the best gems in the crew, and spend
 * shards on crew slots as soon as possible.
 */
export function simulatePlayer(
  profile: PlayerProfile,
  days: number,
  seed: number,
  config: GameConfig = GAME_CONFIG,
  roster: readonly GemDef[] = ROSTER,
): SimResult {
  const rng = createSeededRng(seed);
  const e = config.economy;
  const mult = profile.watchAds ? e.adMultiplier : 1;
  let coins = e.startingCoins;
  let shards = 0;
  let slots = config.crew.startSlots;
  let collection: Collection = {};
  let pity: PityState = INITIAL_PITY;
  let daily: DailyState = INITIAL_DAILY;
  let totalCracks = 0;

  const dayOwned: (number | null)[] = Array.from({ length: roster.length + 1 }, () => null);
  dayOwned[0] = 0;
  const dayFirst: Record<string, number | null> = Object.fromEntries(RARITIES.map((r) => [r, null]));
  const gapMs = (24 / profile.collectsPerDay) * 3_600_000;

  for (let day = 1; day <= days; day++) {
    for (let visit = 0; visit < profile.collectsPerDay; visit++) {
      coins += applyMultiplier(idleAccrued(0, gapMs, config), mult);
      if (visit === 0) {
        const claim = claimDaily(daily, day, config);
        if (claim) {
          daily = claim.daily;
          coins += applyMultiplier(claim.coins, mult);
        }
      }
      for (;;) {
        const count = coins >= e.crackCost10 ? 10 : coins >= e.crackCost1 ? 1 : 0;
        if (count === 0) break;
        const luck = computeLuck(bestCrew(collection, slots, config).map((id) => roster.find((g) => g.id === id)!.rarity), config);
        const batch = crack(count, { collection, pity }, luck, rng, roster, config);
        coins -= count === 10 ? e.crackCost10 : e.crackCost1;
        coins += applyMultiplier(postCrackBonus(count, config), mult);
        collection = batch.collection;
        pity = batch.pity;
        shards += batch.shardsGained;
        totalCracks += count;
        for (const r of batch.results) {
          if (dayFirst[r.gem.rarity] === null) dayFirst[r.gem.rarity] = day;
        }
        for (let slot = nextSlotCost(slots, config); slot !== null && shards >= slot; slot = nextSlotCost(slots, config)) {
          const u = unlockSlot(slots, shards, config)!;
          slots = u.slots;
          shards = u.shards;
        }
      }
    }
    const owned = Object.keys(collection).length;
    for (let n = 1; n <= owned; n++) if (dayOwned[n] === null) dayOwned[n] = day;
  }
  return { dayOwned, dayFirst, totalCracks, ownedAtEnd: Object.keys(collection).length, daysSimulated: days };
}

/** Median of the values, ignoring nulls; null if more than half never happened. */
export function medianDay(values: readonly (number | null)[]): number | null {
  const done = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (done.length * 2 <= values.length) return null;
  return done[Math.floor((values.length - 1) / 2)];
}
