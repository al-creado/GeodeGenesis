import { describe, expect, it } from 'vitest';
import { describeReward, formatDuration, luckPct, pct, shortReward } from './format';

describe('format helpers', () => {
  it('formats odds', () => {
    expect(pct(2.5)).toBe('2.50%');
    expect(pct(59.1716, 1)).toBe('59.2%');
  });
  it('formats luck as a signed percent', () => {
    expect(luckPct(0)).toBe('+0%');
    expect(luckPct(0.035)).toBe('+3.5%');
    expect(luckPct(0.002)).toBe('+0.2%');
    expect(luckPct(0.15)).toBe('+15%');
  });
  it('formats durations', () => {
    expect(formatDuration(3 * 3_600_000 + 12 * 60_000)).toBe('3h 12m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(20_000)).toBe('20s');
  });
  it('describes rewards for players', () => {
    expect(describeReward({ coins: 100 })).toBe('100 coins');
    expect(describeReward({ shards: 5 })).toBe('5 shards');
    expect(describeReward({ tenTickets: 1 })).toBe('a free x10 pull');
    expect(describeReward({ tenTickets: 2 })).toBe('2 free x10 pulls');
    expect(describeReward({ luck: 0.005 })).toBe('+0.5% luck');
    expect(describeReward({ coins: 50, shards: 2 })).toBe('50 coins and 2 shards');
    expect(describeReward({})).toBe('nothing');
  });
  it('shortens rewards for the calendar cells', () => {
    expect(shortReward({ coins: 150 })).toBe('150');
    expect(shortReward({ tenTickets: 1 })).toBe('x10');
    expect(shortReward({ shards: 5 })).toBe('5 sh');
  });
});
