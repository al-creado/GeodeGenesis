import { describe, expect, it } from 'vitest';
import { formatDuration, luckPct, pct } from './format';

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
});
