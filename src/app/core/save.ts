import { GAME_CONFIG, GameConfig } from './config';
import { DailyState, INITIAL_DAILY } from './economy';
import { Collection, INITIAL_PITY, PityState } from './pull';
import { findGem, ROSTER } from './roster';

/** Everything persisted for a player. Bump GAME_CONFIG.saveVersion and add a migration on change. */
export interface SaveData {
  readonly version: number;
  readonly coins: number;
  readonly shards: number;
  readonly collection: Collection;
  readonly pity: PityState;
  readonly crew: readonly string[];
  readonly crewSlots: number;
  readonly lastIdleCollect: number;
  readonly daily: DailyState;
  readonly totalCracks: number;
  readonly settings: { readonly adsEnabled: boolean };
}

export function createNewSave(nowMs: number, config: GameConfig = GAME_CONFIG): SaveData {
  return {
    version: config.saveVersion,
    coins: config.economy.startingCoins,
    shards: 0,
    collection: {},
    pity: INITIAL_PITY,
    crew: [],
    crewSlots: config.crew.startSlots,
    lastIdleCollect: nowMs,
    daily: INITIAL_DAILY,
    totalCracks: 0,
    settings: { adsEnabled: true },
  };
}

/** Old-version upgraders: key N upgrades a version-N save to N+1. */
const MIGRATIONS: Readonly<Record<number, (old: Record<string, unknown>) => Record<string, unknown>>> = {};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
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
  const settings = isObject(data['settings']) ? data['settings'] : {};
  const lastClaim = daily['lastClaimDay'];

  return {
    version: config.saveVersion,
    coins: int(data['coins'], fresh.coins),
    shards: int(data['shards'], 0),
    collection,
    pity: {
      sinceEmerald: int(pity['sinceEmerald'], 0, 0, config.pity.emeraldOrBetter - 1),
      sinceRuby: int(pity['sinceRuby'], 0, 0, config.pity.rubyOrBetter - 1),
    },
    crew,
    crewSlots,
    lastIdleCollect: int(data['lastIdleCollect'], nowMs),
    daily: {
      claimedDay: int(daily['claimedDay'], 0, 0, config.economy.dailyBonus.length),
      lastClaimDay: typeof lastClaim === 'number' && Number.isFinite(lastClaim) ? Math.floor(lastClaim) : null,
    },
    totalCracks: int(data['totalCracks'], 0),
    settings: { adsEnabled: typeof settings['adsEnabled'] === 'boolean' ? settings['adsEnabled'] : true },
  };
}
