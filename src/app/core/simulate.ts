import { GAME_CONFIG, GameConfig, RARITIES, Reward } from './config';
import { applyMultiplier, claimDaily, DailyState, freePullAvailable, INITIAL_DAILY, localWeekNumber, postCrackBonus, scaleReward } from './economy';
import { claimGoal, goalViews, GoalState, INITIAL_GOALS, recordPulls, rollGoals } from './goals';
import { computeLuck, rarityRank } from './odds';
import { claimMilestone, crewMembers, gemLuck, permanentLuck } from './progression';
import { Collection, crack, INITIAL_PITY, PityState } from './pull';
import { exchangeCost, exchangeGem, claimSpark, sparkReady } from './shop';
import { nextSlotCost, unlockSlot } from './crew';
import { createSeededRng } from './rng';
import { GemDef, ROSTER } from './roster';

/** How a simulated player behaves. */
export interface PlayerProfile {
  readonly name: string;
  /** Which days of the week (Monday first) the player opens the game. */
  readonly weekPattern: readonly boolean[];
  /** Watches a rewarded ad for every x2 offer (streak coins and the post-pull bonus). */
  readonly watchAds: boolean;
}

const ALL_DAYS = [true, true, true, true, true, true, true];

export const PROFILES: readonly PlayerProfile[] = [
  { name: 'Occasional (2 days/week, no ads)', weekPattern: [true, false, false, false, true, false, false], watchAds: false },
  { name: 'Casual (3 days/week, no ads)', weekPattern: [true, false, true, false, true, false, false], watchAds: false },
  { name: 'Regular (every day, ads)', weekPattern: ALL_DAYS, watchAds: true },
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

/**
 * Play the game for `days` days with a fixed strategy and report when milestones happen.
 * Strategy: on a play day, claim the streak and goals, take the free pull, spend every coin
 * (x10 when affordable), use tickets, claim milestones, spend sparks and shards on the rarest
 * missing gems, and keep the best gems in the crew.
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
  let tickets = 0;
  let slots = config.crew.startSlots;
  let collection: Collection = {};
  let pity: PityState = INITIAL_PITY;
  let daily: DailyState = INITIAL_DAILY;
  let freePullDay: number | null = null;
  let goals: GoalState = INITIAL_GOALS;
  let claimedMilestones: number[] = [];
  let spark = 0;
  let totalCracks = 0;

  const dayOwned: (number | null)[] = Array.from({ length: roster.length + 1 }, () => null);
  dayOwned[0] = 0;
  const dayFirst: Record<string, number | null> = Object.fromEntries(RARITIES.map((r) => [r, null]));
  let today = 0;

  const give = (r: Reward): void => {
    coins += r.coins ?? 0;
    shards += r.shards ?? 0;
    tickets += r.tenTickets ?? 0;
  };

  const luckNow = (): number => {
    const members = crewMembers(bestCrew(), collection, roster);
    return computeLuck(members, config, permanentLuck(collection, claimedMilestones, roster, config).total);
  };

  const bestCrew = (): string[] =>
    roster
      .filter((g) => collection[g.id])
      .sort((a, b) => gemLuck(b.rarity, collection[b.id].level, config) - gemLuck(a.rarity, collection[a.id].level, config) || a.id.localeCompare(b.id))
      .slice(0, slots)
      .map((g) => g.id);

  const pull = (count: number): void => {
    const batch = crack(count, { collection, pity }, luckNow(), rng, roster, config);
    collection = batch.collection;
    pity = batch.pity;
    shards += batch.shardsGained;
    totalCracks += count;
    spark += count;
    goals = recordPulls(goals, batch.results.map((r) => r.gem.rarity), config);
    for (const r of batch.results) if (dayFirst[r.gem.rarity] === null) dayFirst[r.gem.rarity] = today;
  };

  const missing = (): GemDef[] =>
    roster.filter((g) => !collection[g.id]).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));

  /** Do everything useful until nothing more can be done. Returns whether anything happened. */
  const actOnce = (): boolean => {
    for (const v of goalViews(goals, config)) {
      if (v.done && !v.claimed) {
        const c = claimGoal(goals, v.def.id, config)!;
        goals = c.state;
        give(c.reward);
        return true;
      }
    }
    const owned = Object.keys(collection).length;
    for (const m of config.progression.milestones) {
      const c = claimMilestone(owned, claimedMilestones, m.count, config);
      if (c) {
        claimedMilestones = c.claimed;
        give(c.reward);
        return true;
      }
    }
    if (tickets > 0) {
      tickets--;
      pull(10);
      return true;
    }
    if (sparkReady(spark, config)) {
      const gem = missing()[0] ?? roster[0];
      const c = claimSpark(collection, spark, gem, config)!;
      collection = c.collection;
      spark = c.progress;
      shards += c.shardsGained;
      if (dayFirst[gem.rarity] === null) dayFirst[gem.rarity] = today;
      return true;
    }
    for (const gem of missing()) {
      const x = exchangeGem(collection, shards, gem, config);
      if (x) {
        collection = x.collection;
        shards = x.shards;
        if (dayFirst[gem.rarity] === null) dayFirst[gem.rarity] = today;
        return true;
      }
    }
    const slotCost = nextSlotCost(slots, config);
    if (slotCost !== null && missing().every((g) => exchangeCost(g, config) > shards)) {
      const u = unlockSlot(slots, shards, config);
      if (u) {
        slots = u.slots;
        shards = u.shards;
        return true;
      }
    }
    if (totalCracks === 0) {
      pull(1); // the first pull is free
      return true;
    }
    const count = coins >= e.crackCost10 ? 10 : coins >= e.crackCost1 ? 1 : 0;
    if (count > 0) {
      coins -= count === 10 ? e.crackCost10 : e.crackCost1;
      coins += applyMultiplier(postCrackBonus(count, config), mult);
      pull(count);
      return true;
    }
    return false;
  };

  for (let day = 1; day <= days; day++) {
    today = day;
    if (profile.weekPattern[(day - 1) % 7]) {
      const dayNum = day + 100;
      goals = rollGoals(goals, dayNum, localWeekNumber(dayNum), config);
      const claim = claimDaily(daily, dayNum, config);
      if (claim) {
        daily = claim.daily;
        give(scaleReward(claim.reward, mult));
      }
      if (freePullAvailable(freePullDay, dayNum)) {
        freePullDay = dayNum;
        pull(1);
      }
      for (let guard = 0; guard < 500 && actOnce(); guard++);
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

