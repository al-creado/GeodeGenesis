import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { claimSpark, exchangeCost, exchangeGem, sparkReady } from './shop';
import { findGem, ROSTER } from './roster';

const gem = (id: string) => findGem(ROSTER, id)!;
const S = GAME_CONFIG.shop;

describe('spark', () => {
  it('is ready at the threshold and not before', () => {
    expect(sparkReady(S.sparkAt - 1)).toBe(false);
    expect(sparkReady(S.sparkAt)).toBe(true);
  });
  it('lets you choose any gem, and carries extra progress over', () => {
    const r = claimSpark({}, S.sparkAt + 7, gem('halo'))!;
    expect(r.collection['halo']).toEqual({ level: 1 });
    expect(r.outcome).toBe('new');
    expect(r.progress).toBe(7);
  });
  it('levels up or pays shards when you already own the gem', () => {
    const lv = claimSpark({ pebble: { level: 3 } }, S.sparkAt, gem('pebble'))!;
    expect(lv.outcome).toBe('levelUp');
    expect(lv.collection['pebble'].level).toBe(4);
    const sh = claimSpark({ pebble: { level: 10 } }, S.sparkAt, gem('pebble'))!;
    expect(sh.outcome).toBe('shards');
    expect(sh.shardsGained).toBe(GAME_CONFIG.duplicates.shardsPerDuplicate.quartz);
  });
  it('refuses when the spark is not ready', () => {
    expect(claimSpark({}, S.sparkAt - 1, gem('halo'))).toBeNull();
  });
});

describe('exchange', () => {
  it('prices gems by rarity', () => {
    expect(exchangeCost(gem('pebble'))).toBe(S.exchangeShards.quartz);
    expect(exchangeCost(gem('halo'))).toBe(S.exchangeShards.diamond);
  });
  it('costs more for rarer gems', () => {
    const c = S.exchangeShards;
    expect([c.quartz, c.amethyst, c.emerald, c.ruby, c.diamond]).toEqual([c.quartz, c.amethyst, c.emerald, c.ruby, c.diamond].sort((a, b) => a - b));
  });
  it('buys a missing gem with shards', () => {
    const r = exchangeGem({}, 100, gem('wisp'))!;
    expect(r.collection['wisp']).toEqual({ level: 1 });
    expect(r.shards).toBe(100 - S.exchangeShards.amethyst);
  });
  it('refuses when you cannot afford it or already own it', () => {
    expect(exchangeGem({}, S.exchangeShards.amethyst - 1, gem('wisp'))).toBeNull();
    expect(exchangeGem({ wisp: { level: 1 } }, 999, gem('wisp'))).toBeNull();
  });
  it('does not mutate the collection', () => {
    const c = {};
    exchangeGem(c, 999, gem('wisp'));
    expect(c).toEqual({});
  });
});
