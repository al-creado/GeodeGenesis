import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';

describe('createSeededRng', () => {
  it('is deterministic for a seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });
  it('differs between seeds', () => {
    expect(createSeededRng(1).next()).not.toBe(createSeededRng(2).next());
  });
  it('stays within [0, 1)', () => {
    const r = createSeededRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
