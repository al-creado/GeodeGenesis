import { GAME_CONFIG, GameConfig } from './config';
import { DailyState, INITIAL_DAILY } from './economy';
import { GoalState, INITIAL_GOALS } from './goals';
import { Collection, INITIAL_PITY, PityState } from './pull';
import { findGem, ROSTER } from './roster';

/** Everything persisted for a player. Bump GAME_CONFIG.saveVersion and add a migration on change. */
export interface SaveData {
  readonly version: number;
  readonly coins: number;
  readonly shards: number;
  /** Free x10 pull tickets (from streak and weekly goal rewards). */
  readonly tenTickets: number;
  readonly collection: Collection;
  readonly pity: PityState;
  readonly crew: readonly string[];
  readonly crewSlots: number;
  readonly daily: DailyState;
  /** When the last free pull was taken (epoch ms), or null if it is ready. */
  readonly freePullAt: number | null;
  /** Time taken off the current free-pull wait by ads and shards. */
  readonly freePullBoostMs: number;
  readonly goals: GoalState;
  /** Collection milestones (by gem count) whose reward was claimed. */
  readonly claimedMilestones: readonly number[];
  /** Pulls toward the next spark (pick any gem). */
  readonly sparkProgress: number;
  readonly totalCracks: number;
  readonly settings: {
    readonly adsEnabled: boolean;
    /** The first-run intro has been shown (or the player already had progress). */
    readonly introSeen: boolean;
    /** Sync progress to the cloud. Turned off by "Delete my cloud data". */
    readonly cloudSave: boolean;
  };
  /** When progress last changed (epoch ms). 0 = untouched new game. Used to pick between local and cloud saves. */
  readonly savedAt: number;
}

export function createNewSave(nowMs: number, config: GameConfig = GAME_CONFIG): SaveData {
  return {
    version: config.saveVersion,
    coins: config.economy.startingCoins,
    shards: 0,
    tenTickets: 0,
    collection: {},
    pity: INITIAL_PITY,
    crew: [],
    crewSlots: config.crew.startSlots,
    daily: INITIAL_DAILY,
    freePullAt: null,
    freePullBoostMs: 0,
    goals: INITIAL_GOALS,
    claimedMilestones: [],
    sparkProgress: 0,
    totalCracks: 0,
    settings: { adsEnabled: true, introSeen: false, cloudSave: true },
    savedAt: 0,
  };
}

/** Old-version upgraders: key N upgrades a version-N save to N+1. */
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const MIGRATIONS: Readonly<Record<number, (old: Record<string, unknown>) => Record<string, unknown>>> = {
  // v1 -> v2: add savedAt for cloud conflict resolution.
  1: (old) => ({ ...old, version: 2, savedAt: 0 }),
  // v2 -> v3: settings gain introSeen and cloudSave. Existing players skip the intro.
  2: (old) => {
    const settings = isObject(old['settings']) ? old['settings'] : {};
    const collection = isObject(old['collection']) ? old['collection'] : {};
    const hasProgress = (typeof old['totalCracks'] === 'number' && old['totalCracks'] > 0) || Object.keys(collection).length > 0;
    return { ...old, version: 3, settings: { ...settings, introSeen: hasProgress, cloudSave: true } };
  },
  // v3 -> v4: pure gacha rework. Idle income is gone; goals, tickets, milestones and spark are new.
  // Pulls already made count toward the first spark.
  3: (old) => {
    const { lastIdleCollect: _dropped, ...rest } = old;
    void _dropped;
    return {
      ...rest,
      version: 4,
      tenTickets: 0,
      freePullDay: null,
      goals: INITIAL_GOALS,
      claimedMilestones: [],
      sparkProgress: typeof old['totalCracks'] === 'number' ? old['totalCracks'] : 0,
    };
  },
  // v4 -> v5: the once-a-day free pull becomes a free pull with a shortenable wait.
  // The free pull starts ready, so nobody loses one.
  4: (old) => {
    const { freePullDay: _dropped, ...rest } = old;
    void _dropped;
    return { ...rest, version: 5, freePullAt: null, freePullBoostMs: 0 };
  },
};

const int = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), min), max) : fallback;

/**
 * Turn untrusted stored data into a valid SaveData.
 * Returns null if the data is unusable (not an object, or from a newer app version).
 */
export function migrateSave(raw: unknown, nowMs: number, config: GameConfig = GAME_CONFIG): SaveData | null {
  if (!isObject(raw)) return null;
  let data: Record<string, unknown> = raw;
  let version = int(data['version'], 0);
  if (version > config.saveVersion || version < 1) return null;
  while (version < config.saveVersion) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    version++;
  }

  const fresh = createNewSave(nowMs, config);
  const collection: Record<string, { level: number }> = {};
  if (isObject(data['collection'])) {
    for (const [id, entry] of Object.entries(data['collection'])) {
      if (findGem(ROSTER, id) && isObject(entry)) {
        collection[id] = { level: int(entry['level'], 1, 1, config.duplicates.maxLevel) };
      }
    }
  }
  const crewSlots = int(data['crewSlots'], fresh.crewSlots, config.crew.startSlots, config.crew.maxSlots);
  const crewRaw = Array.isArray(data['crew']) ? data['crew'] : [];
  const crew = [...new Set(crewRaw.filter((id): id is string => typeof id === 'string' && !!collection[id]))].slice(0, crewSlots);
  const pity = isObject(data['pity']) ? data['pity'] : {};
  const daily = isObject(data['daily']) ? data['daily'] : {};
  const goals = isObject(data['goals']) ? data['goals'] : {};
  const settings = isObject(data['settings']) ? data['settings'] : {};
  const lastClaim = daily['lastClaimDay'];

  return {
    version: config.saveVersion,
    coins: int(data['coins'], fresh.coins),
    shards: int(data['shards'], 0),
    tenTickets: int(data['tenTickets'], 0, 0, 1000),
    collection,
    pity: {
      sinceEmerald: int(pity['sinceEmerald'], 0, 0, config.pity.emeraldOrBetter - 1),
      sinceRuby: int(pity['sinceRuby'], 0, 0, config.pity.rubyOrBetter - 1),
    },
    crew,
    crewSlots,
    daily: {
      claimedDay: int(daily['claimedDay'], 0, 0, config.economy.streakRewards.length),
      lastClaimDay: typeof lastClaim === 'number' && Number.isFinite(lastClaim) ? Math.floor(lastClaim) : null,
    },
    freePullAt: typeof data['freePullAt'] === 'number' && Number.isFinite(data['freePullAt']) ? Math.floor(data['freePullAt']) : null,
    freePullBoostMs: int(data['freePullBoostMs'], 0, 0, 7 * 24 * 3_600_000),
    goals: {
      day: int(goals['day'], -1, -1),
      week: int(goals['week'], -1, -1),
      dailyPulls: int(goals['dailyPulls'], 0),
      dailyRare: int(goals['dailyRare'], 0),
      weeklyPulls: int(goals['weeklyPulls'], 0),
      claimed: Array.isArray(goals['claimed']) ? [...new Set(goals['claimed'].filter((id): id is string => typeof id === 'string'))] : [],
    },
    claimedMilestones: Array.isArray(data['claimedMilestones'])
      ? [...new Set(data['claimedMilestones'].filter((n): n is number => config.progression.milestones.some((m) => m.count === n)))]
      : [],
    sparkProgress: int(data['sparkProgress'], 0),
    totalCracks: int(data['totalCracks'], 0),
    settings: {
      adsEnabled: typeof settings['adsEnabled'] === 'boolean' ? settings['adsEnabled'] : true,
      introSeen: typeof settings['introSeen'] === 'boolean' ? settings['introSeen'] : false,
      cloudSave: typeof settings['cloudSave'] === 'boolean' ? settings['cloudSave'] : true,
    },
    savedAt: int(data['savedAt'], 0),
  };
}
