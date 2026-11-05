import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { claimMilestone, crewMembers, gemLuck, milestoneStates, permanentLuck, setStates } from './progression';
import { ROSTER, gemsOfRarity } from './roster';

const own = (ids: string[], level = 1) => Object.fromEntries(ids.map((id) => [id, { level }]));
const ids = (r: Parameters<typeof gemsOfRarity>[1]) => gemsOfRarity(ROSTER, r).map((g) => g.id);

describe('gemLuck', () => {
  it('is the base luck at level 1', () => {
    expect(gemLuck('amethyst', 1)).toBeCloseTo(0.005, 10);
  });
  it('adds 10% of base per level above 1, up to +90% at level 10', () => {
    expect(gemLuck('amethyst', 4)).toBeCloseTo(0.005 * 1.3, 10);
    expect(gemLuck('amethyst', 10)).toBeCloseTo(0.0095, 10);
  });
  it('treats a bad level as 1', () => {
    expect(gemLuck('ruby', 0)).toBeCloseTo(0.02, 10);
  });
});

describe('crewMembers', () => {
  it('maps crew ids to rarity and level, ignoring unknown or unowned gems', () => {
    const c = { plum: { level: 4 }, ember: { level: 1 } };
    expect(crewMembers(['plum', 'ember', 'ghost', 'halo'], c, ROSTER)).toEqual([
      { rarity: 'amethyst', level: 4 },
      { rarity: 'ruby', level: 1 },
    ]);
  });
});

describe('milestones', () => {
  it('marks reached and claimed milestones', () => {
    const s = milestoneStates(13, [6], GAME_CONFIG);
    expect(s.map((m) => [m.def.count, m.reached, m.claimed])).toEqual([
      [6, true, true],
      [12, true, false],
      [18, false, false],
      [24, false, false],
    ]);
  });
  it('claims a reached milestone once', () => {
    const c = claimMilestone(12, [], 12)!;
    expect(c.reward).toEqual({ shards: 10 });
    expect(c.claimed).toEqual([12]);
    expect(claimMilestone(12, c.claimed, 12)).toBeNull();
  });
  it('refuses a milestone that is not reached or unknown', () => {
    expect(claimMilestone(11, [], 12)).toBeNull();
    expect(claimMilestone(30, [], 7)).toBeNull();
  });
});

describe('sets and permanent luck', () => {
  it('counts owned gems per rarity and completes a set', () => {
    const sets = setStates(own([...ids('amethyst'), 'pebble']), ROSTER);
    const amethyst = sets.find((s) => s.rarity === 'amethyst')!;
    expect(amethyst).toMatchObject({ owned: 7, total: 7, complete: true, bonus: 0.005 });
    expect(sets.find((s) => s.rarity === 'quartz')).toMatchObject({ owned: 1, total: 8, complete: false });
  });
  it('an empty collection has no complete sets', () => {
    expect(setStates({}, ROSTER).every((s) => !s.complete)).toBe(true);
  });
  it('adds completed set bonuses and claimed milestone luck', () => {
    const c = own([...ids('amethyst'), ...ids('diamond')]);
    const p = permanentLuck(c, [6, 18, 24], ROSTER);
    expect(p.sets).toBeCloseTo(0.005 + 0.03, 10);
    expect(p.milestones).toBeCloseTo(0.005 + 0.01, 10); // milestone 6 pays coins, not luck
    expect(p.total).toBeCloseTo(p.sets + p.milestones, 10);
  });
  it('ignores unclaimed milestones', () => {
    expect(permanentLuck({}, [], ROSTER).total).toBe(0);
  });
});
