import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { crewTimerReduction, crewTotals, gemPassives, previewCrewChange } from './passives';

const m = (id: string, rarity: 'quartz' | 'amethyst' | 'emerald' | 'ruby' | 'diamond', level = 1) => ({ id, rarity, level });

describe('gemPassives', () => {
  it('gives luck and a timer cut by rarity at level 1', () => {
    expect(gemPassives('quartz', 1)).toEqual({ luck: 0.002, timerReduction: 0 });
    expect(gemPassives('amethyst', 1).timerReduction).toBeCloseTo(0.02, 10);
    expect(gemPassives('diamond', 1).timerReduction).toBeCloseTo(0.1, 10);
  });
  it('Quartz gems never cut the timer, the rarer ones do', () => {
    const cuts = (['quartz', 'amethyst', 'emerald', 'ruby', 'diamond'] as const).map((r) => gemPassives(r, 1).timerReduction);
    expect(cuts[0]).toBe(0);
    expect(cuts).toEqual([...cuts].sort((a, b) => a - b));
    expect(cuts[1]).toBeGreaterThan(0);
  });
  it('both passives grow 10% of their base per level above 1', () => {
    const p = gemPassives('ruby', 5);
    expect(p.luck).toBeCloseTo(0.02 * 1.4, 10);
    expect(p.timerReduction).toBeCloseTo(0.06 * 1.4, 10);
    expect(gemPassives('ruby', 10).timerReduction).toBeCloseTo(0.06 * 1.9, 10);
  });
  it('treats a bad level as 1', () => {
    expect(gemPassives('emerald', 0)).toEqual(gemPassives('emerald', 1));
  });
});

describe('crew totals', () => {
  it('sums the crew timer cuts', () => {
    expect(crewTimerReduction([m('a', 'ruby'), m('b', 'emerald'), m('c', 'quartz')])).toBeCloseTo(0.1, 10);
    expect(crewTimerReduction([])).toBe(0);
  });
  it('caps the total timer cut', () => {
    const full = [m('a', 'diamond', 10), m('b', 'ruby', 10), m('c', 'ruby', 10), m('d', 'ruby', 10), m('e', 'emerald', 10)];
    expect(crewTimerReduction(full)).toBe(GAME_CONFIG.freePull.maxReduction);
  });
  it('returns luck (with permanent luck) and timer cut together', () => {
    const t = crewTotals([m('a', 'ruby')], 0.01);
    expect(t.luck).toBeCloseTo(0.03, 10);
    expect(t.timerReduction).toBeCloseTo(0.06, 10);
  });
});

describe('previewCrewChange', () => {
  const crew = [m('fern', 'emerald'), m('plum', 'amethyst')];

  it('adds a gem', () => {
    const p = previewCrewChange(crew, 0, { add: m('ember', 'ruby') });
    expect(p.before.luck).toBeCloseTo(0.015, 10);
    expect(p.after.luck).toBeCloseTo(0.035, 10);
    expect(p.before.timerReduction).toBeCloseTo(0.06, 10);
    expect(p.after.timerReduction).toBeCloseTo(0.12, 10);
  });
  it('removes a gem by id', () => {
    const p = previewCrewChange(crew, 0, { removeId: 'fern' });
    expect(p.after.luck).toBeCloseTo(0.005, 10);
    expect(p.after.timerReduction).toBeCloseTo(0.02, 10);
  });
  it('does not mutate the crew', () => {
    const copy = [...crew];
    previewCrewChange(crew, 0, { add: m('halo', 'diamond') });
    expect(crew).toEqual(copy);
  });
  it('shows no change when luck is already capped and the gem adds no timer cut', () => {
    const p = previewCrewChange([], 0.2, { add: m('pebble', 'quartz') });
    expect(p.before.luck).toBe(GAME_CONFIG.crew.luckCap);
    expect(p.after.luck).toBe(GAME_CONFIG.crew.luckCap);
    expect(p.after.timerReduction).toBe(0);
  });
});
