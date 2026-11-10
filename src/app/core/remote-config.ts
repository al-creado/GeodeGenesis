import { GAME_CONFIG, GameConfig, RARITIES, Rarity, Reward } from './config';

export interface OverrideResult {
  readonly config: GameConfig;
  /** Dotted names of the groups that were applied. */
  readonly applied: readonly string[];
  /** Dotted names of the groups that were ignored as invalid. */
  readonly rejected: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min: number, max = 1_000_000_000): v is number => isNum(v) && Number.isInteger(v) && v >= min && v <= max;

/**
 * Apply a Remote Config JSON override to a base config.
 *
 * Only economy tuning numbers can change. Ad unit ids, save version, level cap, slot counts,
 * goals, milestones, set bonuses, passive timer cuts and unlock rules are never overridable. Each group is validated on its own: an invalid
 * group is ignored and the rest still applies. Odds must still sum to 100.
 */
export function applyRemoteOverrides(base: GameConfig, raw: unknown): OverrideResult {
  const applied: string[] = [];
  const rejected: string[] = [];
  if (!isObject(raw)) return { config: base, applied, rejected };

  let economy = base.economy;
  let baseOdds = base.baseOdds;
  let luckPerGem = base.luckPerGem;
  let crew = base.crew;
  let pity = base.pity;
  let duplicates = base.duplicates;
  let shop = base.shop;
  let freePull = base.freePull;

  const group = (name: string, present: boolean, apply: () => boolean): void => {
    if (!present) return;
    if (apply()) applied.push(name);
    else rejected.push(name);
  };

  const e = raw['economy'];
  group('economy', isObject(e), () => {
    const o = e as Record<string, unknown>;
    const next = { ...economy };
    const ints: [keyof typeof economy, number][] = [
      ['startingCoins', 0], ['crackCost1', 1], ['crackCost10', 1], ['postCrackBonus', 0],
    ];
    for (const [key, min] of ints) {
      if (key in o) {
        if (!isInt(o[key], min)) return false;
        (next as Record<string, unknown>)[key] = o[key];
      }
    }
    if ('adMultiplier' in o) {
      if (!isNum(o['adMultiplier']) || o['adMultiplier'] < 1 || o['adMultiplier'] > 10) return false;
      next.adMultiplier = o['adMultiplier'];
    }
    if ('streakRewards' in o) {
      const d = o['streakRewards'];
      if (!Array.isArray(d) || d.length !== base.economy.streakRewards.length) return false;
      const rewards: Reward[] = [];
      for (const r of d) {
        if (!isObject(r)) return false;
        for (const k of Object.keys(r)) if (!['coins', 'shards', 'tenTickets'].includes(k)) return false; // never luck
        for (const k of ['coins', 'shards']) if (k in r && !isInt(r[k], 0)) return false;
        if ('tenTickets' in r && !isInt(r['tenTickets'], 0, 5)) return false;
        rewards.push({ ...(r['coins'] !== undefined ? { coins: r['coins'] as number } : {}), ...(r['shards'] !== undefined ? { shards: r['shards'] as number } : {}), ...(r['tenTickets'] !== undefined ? { tenTickets: r['tenTickets'] as number } : {}) });
      }
      next.streakRewards = rewards;
    }
    economy = next;
    return true;
  });

  const odds = raw['baseOdds'];
  group('baseOdds', isObject(odds), () => {
    const o = odds as Record<string, unknown>;
    const next = { ...baseOdds } as Record<Rarity, number>;
    for (const r of RARITIES) {
      if (r in o) {
        if (!isNum(o[r]) || o[r] < 0) return false;
        next[r] = o[r];
      }
    }
    const total = RARITIES.reduce((a, r) => a + next[r], 0);
    if (Math.abs(total - 100) > 0.001 || next.quartz <= 0) return false;
    baseOdds = next;
    return true;
  });

  const luck = raw['luckPerGem'];
  group('luckPerGem', isObject(luck), () => {
    const o = luck as Record<string, unknown>;
    const next = { ...luckPerGem } as Record<Rarity, number>;
    for (const r of RARITIES) {
      if (r in o) {
        if (!isNum(o[r]) || o[r] < 0 || o[r] > 0.5) return false;
        next[r] = o[r];
      }
    }
    luckPerGem = next;
    return true;
  });

  const c = raw['crew'];
  group('crew', isObject(c), () => {
    const o = c as Record<string, unknown>;
    const next = { ...crew };
    if ('luckCap' in o) {
      if (!isNum(o['luckCap']) || o['luckCap'] < 0 || o['luckCap'] > 1) return false;
      next.luckCap = o['luckCap'];
    }
    if ('slotUnlockShards' in o) {
      const s = o['slotUnlockShards'];
      if (!Array.isArray(s) || s.length !== base.crew.slotUnlockShards.length || !s.every((x) => isInt(x, 0))) return false;
      next.slotUnlockShards = s as number[];
    }
    crew = next;
    return true;
  });

  const p = raw['pity'];
  group('pity', isObject(p), () => {
    const o = p as Record<string, unknown>;
    const next = { ...pity };
    for (const key of ['emeraldOrBetter', 'rubyOrBetter'] as const) {
      if (key in o) {
        if (!isInt(o[key], 1, 10_000)) return false;
        next[key] = o[key];
      }
    }
    pity = next;
    return true;
  });

  const d = raw['duplicates'];
  group('duplicates', isObject(d) && isObject((d as Record<string, unknown>)['shardsPerDuplicate']), () => {
    const o = (d as Record<string, unknown>)['shardsPerDuplicate'] as Record<string, unknown>;
    const next = { ...duplicates.shardsPerDuplicate } as Record<Rarity, number>;
    for (const r of RARITIES) {
      if (r in o) {
        if (!isInt(o[r], 0)) return false;
        next[r] = o[r];
      }
    }
    duplicates = { ...duplicates, shardsPerDuplicate: next };
    return true;
  });

  const sh = raw['shop'];
  group('shop', isObject(sh), () => {
    const o = sh as Record<string, unknown>;
    const next = { ...shop, exchangeShards: { ...shop.exchangeShards } as Record<Rarity, number> };
    if ('sparkAt' in o) {
      if (!isInt(o['sparkAt'], 1, 100_000)) return false;
      next.sparkAt = o['sparkAt'];
    }
    if ('exchangeShards' in o) {
      const ex = o['exchangeShards'];
      if (!isObject(ex)) return false;
      for (const r of RARITIES) {
        if (r in ex) {
          if (!isInt(ex[r], 1)) return false;
          next.exchangeShards[r] = ex[r];
        }
      }
    }
    shop = next;
    return true;
  });

  const fp = raw['freePull'];
  group('freePull', isObject(fp), () => {
    const o = fp as Record<string, unknown>;
    const next = { ...freePull };
    if ('cooldownMs' in o) {
      if (!isInt(o['cooldownMs'], 60_000, 7 * 24 * 3_600_000)) return false;
      next.cooldownMs = o['cooldownMs'];
    }
    for (const key of ['adReduceMs', 'shardReduceMs'] as const) {
      if (key in o) {
        if (!isInt(o[key], 0, 7 * 24 * 3_600_000)) return false;
        next[key] = o[key];
      }
    }
    if ('shardCost' in o) {
      if (!isInt(o['shardCost'], 1, 100_000)) return false;
      next.shardCost = o['shardCost'];
    }
    if ('maxReduction' in o) {
      if (!isNum(o['maxReduction']) || o['maxReduction'] < 0 || o['maxReduction'] > 0.9) return false;
      next.maxReduction = o['maxReduction'];
    }
    freePull = next;
    return true;
  });

  return { config: { ...base, economy, baseOdds, luckPerGem, crew, pity, duplicates, shop, freePull }, applied, rejected };
}

/** Parse the JSON string stored in the `economy_config` Remote Config parameter. */
export function parseRemoteConfigJson(text: string | null | undefined, base: GameConfig = GAME_CONFIG): OverrideResult {
  if (!text || !text.trim()) return { config: base, applied: [], rejected: [] };
  try {
    return applyRemoteOverrides(base, JSON.parse(text));
  } catch {
    return { config: base, applied: [], rejected: ['json'] };
  }
}
