/**
 * Central game configuration. Every tunable number lives here; nothing else in
 * the codebase may hard-code costs, odds, luck, caps, pity or idle rates.
 * (Stage 5: these values can be overridden by Firebase Remote Config.)
 */

export const RARITIES = ['quartz', 'amethyst', 'emerald', 'ruby', 'diamond'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface GameConfig {
  readonly saveVersion: number;
  readonly economy: {
    readonly startingCoins: number;
    readonly crackCost1: number;
    readonly crackCost10: number;
    /** Idle coins earned per hour while away. */
    readonly idleCoinsPerHour: number;
    readonly idleCapHours: number;
    /** Multiplier granted by a completed rewarded ad. Never affects odds. */
    readonly adMultiplier: number;
    /** Coins awarded on day 1..7 of the daily bonus streak. */
    readonly dailyBonus: readonly number[];
    /** Coin bonus granted per crack (a rewarded ad multiplies it). */
    readonly postCrackBonus: number;
  };
  /** Base odds in percent; must sum to 100. */
  readonly baseOdds: Readonly<Record<Rarity, number>>;
  /** Luck added per crew gem of each rarity, as a fraction (0.002 = +0.2%). */
  readonly luckPerGem: Readonly<Record<Rarity, number>>;
  readonly crew: {
    readonly startSlots: number;
    readonly maxSlots: number;
    /** Max total luck as a fraction (0.15 = +15%). */
    readonly luckCap: number;
    /** Shard cost to unlock each slot beyond startSlots (slot 4, then slot 5). */
    readonly slotUnlockShards: readonly number[];
  };
  readonly pity: {
    /** Emerald-or-better guaranteed on this many cracks without one. */
    readonly emeraldOrBetter: number;
    /** Ruby-or-better guaranteed on this many cracks without one. */
    readonly rubyOrBetter: number;
  };
  readonly ads: {
    /** Length of the fake ad shown by the browser-only Simulated provider. */
    readonly simulatedDurationMs: number;
    /** How long to wait for a rewarded ad to load before giving up. */
    readonly loadTimeoutMs: number;
    /** Google TEST ids only. Real ids are a Stage 6 release task. */
    readonly admob: {
      readonly appId: string;
      readonly rewardedUnitId: string;
    };
  };
  readonly duplicates: {
    readonly maxLevel: number;
    /** Shards earned when a duplicate is pulled at max level. */
    readonly shardsPerDuplicate: Readonly<Record<Rarity, number>>;
  };
}

export const GAME_CONFIG: GameConfig = {
  saveVersion: 2,
  economy: {
    startingCoins: 300,
    crackCost1: 100,
    crackCost10: 900,
    idleCoinsPerHour: 40,
    idleCapHours: 8,
    adMultiplier: 2,
    dailyBonus: [20, 30, 40, 60, 80, 100, 150],
    postCrackBonus: 10,
  },
  baseOdds: { quartz: 60, amethyst: 28, emerald: 9, ruby: 2.5, diamond: 0.5 },
  luckPerGem: {
    quartz: 0.002,
    amethyst: 0.005,
    emerald: 0.01,
    ruby: 0.02,
    diamond: 0.03,
  },
  crew: { startSlots: 3, maxSlots: 5, luckCap: 0.15, slotUnlockShards: [50, 150] },
  ads: {
    simulatedDurationMs: 3000,
    loadTimeoutMs: 15000,
    admob: {
      // Google's published sample ids for Android.
      appId: 'ca-app-pub-3940256099942544~3347511713',
      rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    },
  },
  pity: { emeraldOrBetter: 10, rubyOrBetter: 50 },
  duplicates: {
    maxLevel: 10,
    shardsPerDuplicate: { quartz: 1, amethyst: 3, emerald: 10, ruby: 30, diamond: 100 },
  },
};
