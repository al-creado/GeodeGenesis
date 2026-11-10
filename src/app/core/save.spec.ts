import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { createNewSave, migrateSave } from './save';

const NOW = 1_700_000_000_000;

describe('createNewSave', () => {
  it('uses config defaults and the current version', () => {
    const s = createNewSave(NOW);
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.coins).toBe(GAME_CONFIG.economy.startingCoins);
    expect(s.crewSlots).toBe(GAME_CONFIG.crew.startSlots);
    expect(s.tenTickets).toBe(0);
    expect(s.freePullAt).toBeNull();
    expect(s.freePullBoostMs).toBe(0);
    expect(s.sparkProgress).toBe(0);
    expect(s.claimedMilestones).toEqual([]);
  });
});

describe('migrateSave', () => {
  it('round-trips a valid save', () => {
    const s = { ...createNewSave(NOW), coins: 555, shards: 12, collection: { pebble: { level: 4 } }, crew: ['pebble'] };
    expect(migrateSave(JSON.parse(JSON.stringify(s)), NOW)).toEqual(s);
  });
  it('upgrades a v1 save to v2 with savedAt 0', () => {
    const v1 = { version: 1, coins: 77, collection: { pebble: { level: 2 } } };
    const s = migrateSave(v1, NOW)!;
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.coins).toBe(77);
    expect(s.savedAt).toBe(0);
    expect(s.collection['pebble'].level).toBe(2);
  });
  it('upgrades v2 saves: existing players skip the intro, new ones see it', () => {
    const played = migrateSave({ version: 2, totalCracks: 4, collection: { pebble: { level: 1 } }, settings: { adsEnabled: false }, savedAt: 9 }, NOW)!;
    expect(played.version).toBe(GAME_CONFIG.saveVersion);
    expect(played.settings).toEqual({ adsEnabled: false, introSeen: true, cloudSave: true });
    const fresh = migrateSave({ version: 2, settings: {} }, NOW)!;
    expect(fresh.settings.introSeen).toBe(false);
  });
  it('upgrades v1 all the way to the current version', () => {
    const s = migrateSave({ version: 1, coins: 5, totalCracks: 2 }, NOW)!;
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.settings.introSeen).toBe(true);
  });
  it('upgrades v4 to v5: the free pull starts ready and the old day field is dropped', () => {
    const s = migrateSave({ version: 4, coins: 50, freePullDay: 19999, totalCracks: 3, collection: { pebble: { level: 1 } } }, NOW)!;
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.freePullAt).toBeNull();
    expect(s.freePullBoostMs).toBe(0);
    expect(s.coins).toBe(50);
    expect(JSON.stringify(s)).not.toContain('freePullDay');
  });
  it('keeps and sanitizes the free-pull timer', () => {
    const ok = migrateSave({ ...createNewSave(NOW), freePullAt: 12345.9, freePullBoostMs: 600000 }, NOW)!;
    expect(ok.freePullAt).toBe(12345);
    expect(ok.freePullBoostMs).toBe(600000);
    const bad = migrateSave({ ...createNewSave(NOW), freePullAt: 'soon', freePullBoostMs: -5 }, NOW)!;
    expect(bad.freePullAt).toBeNull();
    expect(bad.freePullBoostMs).toBe(0);
  });
  it('keeps savedAt on a v2 save', () => {
    expect(migrateSave({ ...createNewSave(NOW), savedAt: 12345 }, NOW)!.savedAt).toBe(12345);
  });
  it('rejects junk, missing version and newer versions', () => {
    expect(migrateSave(null, NOW)).toBeNull();
    expect(migrateSave('x', NOW)).toBeNull();
    expect(migrateSave([], NOW)).toBeNull();
    expect(migrateSave({ coins: 5 }, NOW)).toBeNull();
    expect(migrateSave({ version: GAME_CONFIG.saveVersion + 1 }, NOW)).toBeNull();
  });
  it('sanitizes bad values', () => {
    const s = migrateSave(
      {
        version: 1,
        coins: -50,
        shards: 'lots',
        collection: { pebble: { level: 99 }, ghost: { level: 1 }, plum: 'x' },
        crew: ['pebble', 'pebble', 'ghost', 'plum', 7],
        crewSlots: 99,
        pity: { sinceEmerald: 500, sinceRuby: -3 },
        daily: { claimedDay: 40, lastClaimDay: 'yesterday' },
        settings: { adsEnabled: 'no' },
      },
      NOW,
    )!;
    expect(s.coins).toBe(0);
    expect(s.shards).toBe(0);
    expect(s.collection).toEqual({ pebble: { level: GAME_CONFIG.duplicates.maxLevel } });
    expect(s.crew).toEqual(['pebble']);
    expect(s.crewSlots).toBe(GAME_CONFIG.crew.maxSlots);
    expect(s.pity).toEqual({ sinceEmerald: GAME_CONFIG.pity.emeraldOrBetter - 1, sinceRuby: 0 });
    expect(s.daily).toEqual({ claimedDay: 7, lastClaimDay: null });
    expect(s.settings).toEqual({ adsEnabled: true, introSeen: true, cloudSave: true }); // has a collection, so no intro
  });
  it('trims the crew to the slot count', () => {
    const s = migrateSave(
      { version: 1, crewSlots: 3, collection: { pebble: { level: 1 }, plum: { level: 1 }, fern: { level: 1 }, ember: { level: 1 } }, crew: ['pebble', 'plum', 'fern', 'ember'] },
      NOW,
    )!;
    expect(s.crew).toHaveLength(3);
  });
});
