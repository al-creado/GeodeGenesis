import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { addToCrew, crewRarities, nextSlotCost, removeFromCrew, unlockSlot } from './crew';
import { ROSTER } from './roster';

const owned = { pebble: { level: 1 }, plum: { level: 2 }, fern: { level: 1 }, ember: { level: 1 } };

describe('crew', () => {
  it('adds an owned gem', () => {
    const r = addToCrew([], 'pebble', 3, owned);
    expect(r).toEqual({ ok: true, crew: ['pebble'] });
  });
  it('rejects unowned, duplicate and over-capacity adds', () => {
    expect(addToCrew([], 'halo', 3, owned)).toEqual({ ok: false, reason: 'notOwned' });
    expect(addToCrew(['pebble'], 'pebble', 3, owned)).toEqual({ ok: false, reason: 'duplicate' });
    expect(addToCrew(['pebble', 'plum', 'fern'], 'ember', 3, owned)).toEqual({ ok: false, reason: 'full' });
  });
  it('removes a gem', () => {
    expect(removeFromCrew(['pebble', 'plum'], 'pebble')).toEqual({ ok: true, crew: ['plum'] });
    expect(removeFromCrew(['plum'], 'pebble')).toEqual({ ok: false, reason: 'notInCrew' });
  });
  it('maps crew ids to rarities, ignoring unknown ids', () => {
    expect(crewRarities(['pebble', 'ember', 'ghost'], ROSTER)).toEqual(['quartz', 'ruby']);
  });
});

describe('slot unlocks', () => {
  const [c4, c5] = GAME_CONFIG.crew.slotUnlockShards;
  it('prices slots 4 and 5, then nothing', () => {
    expect(nextSlotCost(3)).toBe(c4);
    expect(nextSlotCost(4)).toBe(c5);
    expect(nextSlotCost(5)).toBeNull();
  });
  it('spends shards to unlock', () => {
    expect(unlockSlot(3, c4 + 7)).toEqual({ slots: 4, shards: 7 });
    expect(unlockSlot(3, c4 - 1)).toBeNull();
    expect(unlockSlot(5, 9999)).toBeNull();
  });
});
