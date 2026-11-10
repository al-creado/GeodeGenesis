/**
 * Central game configuration. Every tunable number lives here; nothing else in
 * the codebase may hard-code costs, odds, luck, caps, pity, rewards or unlock rules.
 * (Stage 5: these values can be overridden by Firebase Remote Config.)
 */

export const RARITIES = ['quartz', 'amethyst', 'emerald', 'ruby', 'diamond'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Something the player can be given: coins, shards, a free x10 ticket, or permanent luck. */
export interface Reward {
  readonly coins?: number;
  readonly shards?: number;
  readonly tenTickets?: number;
  /** Permanent luck as a fraction (0.005 = +0.5%). Only used by collection milestones. */
  readonly luck?: number;
}

export interface GoalDef {
  readonly id: string;
  readonly label: string;
  /** pulls: every pull. rareFinds: pulls that gave `goals.rareFrom` or better. */
  readonly metric: 'pulls' | 'rareFinds';
  readonly target: number;
  readonly reward: Reward;
}

export interface MilestoneDef {
  /** Distinct gems found. */
  readonly count: number;
  readonly reward: Reward;
}

export interface GameConfig {
  readonly saveVersion: number;
  readonly economy: {
    readonly startingCoins: number;
    readonly crackCost1: number;
    readonly crackCost10: number;
    /** Multiplier granted by a completed rewarded ad. Never affects odds. */
    readonly adMultiplier: number;
    /** What the login streak pays on day 1..7. */
    readonly streakRewards: readonly Reward[];
    /** Coin bonus granted per paid pull (a rewarded ad multiplies it). */
    readonly postCrackBonus: number;
  };
  /** The free pull: it comes back after a wait that can be shortened. */
  readonly freePull: {
    /** Base wait between free pulls, in milliseconds. */
    readonly cooldownMs: number;
    /** Time one rewarded ad takes off the wait. */
    readonly adReduceMs: number;
    /** Time one shard payment takes off the wait. */
    readonly shardReduceMs: number;
    /** Shards paid for one reduction. */
    readonly shardCost: number;
    /** The most the crew's passive timer reduction can cut, as a fraction (0.5 = half). */
    readonly maxReduction: number;
  };
  readonly goals: {
    readonly daily: readonly GoalDef[];
    readonly weekly: readonly GoalDef[];
    /** The rarity that counts as a "rare find" for goals. */
    readonly rareFrom: Rarity;
  };
  readonly progression: {
    /** Each gem level above 1 adds this fraction of the gem's base luck. */
    readonly levelLuckFactor: number;
    readonly milestones: readonly MilestoneDef[];
    /** Permanent luck for owning every gem of a rarity. */
    readonly setBonuses: Readonly<Record<Rarity, number>>;
  };
  readonly shop: {
    /** Pulls needed to earn one spark (pick any gem). */
    readonly sparkAt: number;
    /** Shard price to buy a specific missing gem, by rarity. */
    readonly exchangeShards: Readonly<Record<Rarity, number>>;
  };
  /** When tabs and extras appear for a new player. */
  readonly unlocks: {
    readonly vaultAfterPulls: number;
    readonly dailyAfterPulls: number;
    /** Crew unlocks once the player owns a gem of this rarity or better. */
    readonly crewAfterRarity: Rarity;
    readonly shopAfterPulls: number;
    readonly pityAfterPulls: number;
  };
  /** Base odds in percent; must sum to 100. */
  readonly baseOdds: Readonly<Record<Rarity, number>>;
  /** Luck added per crew gem of each rarity, as a fraction (0.002 = +0.2%). */
  readonly luckPerGem: Readonly<Record<Rarity, number>>;
  /** Passive free-pull wait cut per crew gem of each rarity at level 1, as a fraction (0.02 = 2%). Grows with level like luck. */
  readonly timerReductionPerGem: Readonly<Record<Rarity, number>>;
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
    /** How long to wait before asking for another rewarded ad after one failed to load. */
    readonly retryMs: number;
    /** How long to wait for a rewarded ad to load before giving up. */
    readonly loadTimeoutMs: number;
    /**
     * AdMob ids. Today these are Google's TEST ids and useTestAds is true.
     * For release: put the real unit id here, the real app id in android strings.xml,
     * and set useTestAds to false (see docs/release/release-checklist.md).
     */
    readonly admob: {
      readonly appId: string;
      readonly rewardedUnitId: string;
      /** Request test ads and register as a test device. Must be false for production. */
      readonly useTestAds: boolean;
    };
  };
  readonly legal: {
    /** Public URL of the privacy policy (required by Google Play). Set before release. */
    readonly privacyPolicyUrl: string;
    /** Support contact shown in the store listing and policy. */
    readonly supportEmail: string;
  };
  readonly duplicates: {
    readonly maxLevel: number;
    /** Shards earned when a duplicate is pulled at max level. */
    readonly shardsPerDuplicate: Readonly<Record<Rarity, number>>;
  };
}

export const GAME_CONFIG: GameConfig = {
  saveVersion: 5,
  economy: {
    startingCoins: 300,
    crackCost1: 100,
    crackCost10: 900,
    adMultiplier: 2,
    streakRewards: [
      { coins: 100 }, { coins: 100 }, { coins: 150 }, { coins: 150 }, { coins: 200 }, { coins: 250 },
      { tenTickets: 1 },
    ],
    postCrackBonus: 3,
  },
  freePull: { cooldownMs: 4 * 3_600_000, adReduceMs: 3_600_000, shardReduceMs: 3_600_000, shardCost: 3, maxReduction: 0.5 },
  goals: {
    rareFrom: 'amethyst',
    daily: [
      { id: 'd-pulls', label: 'Pull 10 times today', metric: 'pulls', target: 10, reward: { coins: 100 } },
      { id: 'd-rare', label: 'Find an Amethyst or better', metric: 'rareFinds', target: 1, reward: { shards: 5 } },
    ],
    weekly: [{ id: 'w-pulls', label: 'This week: pull 70 times', metric: 'pulls', target: 70, reward: { tenTickets: 1 } }],
  },
  progression: {
    levelLuckFactor: 0.1,
    milestones: [
      { count: 6, reward: { coins: 200 } },
      { count: 12, reward: { shards: 10 } },
      { count: 18, reward: { luck: 0.005 } },
      { count: 24, reward: { luck: 0.01 } },
    ],
    setBonuses: { quartz: 0.002, amethyst: 0.005, emerald: 0.01, ruby: 0.02, diamond: 0.03 },
  },
  shop: {
    sparkAt: 150,
    exchangeShards: { quartz: 20, amethyst: 60, emerald: 150, ruby: 250, diamond: 600 },
  },
  unlocks: { vaultAfterPulls: 1, dailyAfterPulls: 1, crewAfterRarity: 'emerald', shopAfterPulls: 10, pityAfterPulls: 10 },
  baseOdds: { quartz: 60, amethyst: 28, emerald: 9, ruby: 2.5, diamond: 0.5 },
  luckPerGem: {
    quartz: 0.002,
    amethyst: 0.005,
    emerald: 0.01,
    ruby: 0.02,
    diamond: 0.03,
  },
  timerReductionPerGem: { quartz: 0, amethyst: 0.02, emerald: 0.04, ruby: 0.06, diamond: 0.1 },
  crew: { startSlots: 3, maxSlots: 5, luckCap: 0.15, slotUnlockShards: [50, 150] },
  ads: {
    retryMs: 30000,
    loadTimeoutMs: 15000,
    admob: {
      // Google's published sample ids for Android.
      appId: 'ca-app-pub-3940256099942544~3347511713',
      rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
      useTestAds: true,
    },
  },
  pity: { emeraldOrBetter: 10, rubyOrBetter: 50 },
  legal: { privacyPolicyUrl: '', supportEmail: '' },
  duplicates: {
    maxLevel: 10,
    shardsPerDuplicate: { quartz: 1, amethyst: 3, emerald: 10, ruby: 30, diamond: 100 },
  },
};
