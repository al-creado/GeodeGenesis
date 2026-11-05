import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { claimGoal, goalViews, INITIAL_GOALS, recordPulls, rollGoals } from './goals';

const D = GAME_CONFIG.goals;
const find = (views: ReturnType<typeof goalViews>, id: string) => views.find((v) => v.def.id === id)!;

describe('goals', () => {
  it('starts empty and resets nothing on first roll except setting the period', () => {
    const s = rollGoals(INITIAL_GOALS, 100, 20);
    expect(s).toMatchObject({ day: 100, week: 20, dailyPulls: 0, weeklyPulls: 0, claimed: [] });
  });

  it('counts pulls and rare finds', () => {
    let s = rollGoals(INITIAL_GOALS, 100, 20);
    s = recordPulls(s, ['quartz', 'quartz', 'amethyst', 'diamond']);
    expect(s.dailyPulls).toBe(4);
    expect(s.weeklyPulls).toBe(4);
    expect(s.dailyRare).toBe(2); // amethyst and better
  });

  it('shows progress capped at the target, and marks done goals', () => {
    let s = rollGoals(INITIAL_GOALS, 100, 20);
    s = recordPulls(s, Array(12).fill('quartz'));
    const v = goalViews(s);
    expect(find(v, 'd-pulls')).toMatchObject({ progress: 10, done: true, claimed: false });
    expect(find(v, 'd-rare')).toMatchObject({ progress: 0, done: false });
    expect(find(v, 'w-pulls')).toMatchObject({ progress: 12, done: false });
  });

  it('claims a finished goal once and returns its reward', () => {
    let s = rollGoals(INITIAL_GOALS, 100, 20);
    s = recordPulls(s, Array(10).fill('quartz'));
    const c = claimGoal(s, 'd-pulls')!;
    expect(c.reward).toEqual(D.daily[0].reward);
    expect(claimGoal(c.state, 'd-pulls')).toBeNull();
    expect(claimGoal(s, 'd-rare')).toBeNull(); // not finished
    expect(claimGoal(s, 'nope')).toBeNull();
  });

  it('resets daily goals at midnight but keeps the weekly one', () => {
    let s = rollGoals(INITIAL_GOALS, 100, 20);
    s = recordPulls(s, Array(10).fill('amethyst'));
    s = claimGoal(s, 'd-pulls')!.state;
    s = claimGoal(s, 'd-rare')!.state;
    const next = rollGoals(s, 101, 20);
    expect(next.dailyPulls).toBe(0);
    expect(next.dailyRare).toBe(0);
    expect(next.weeklyPulls).toBe(10);
    expect(next.claimed).toEqual([]);
  });

  it('resets the weekly goal on a new week and keeps a claimed weekly claim within the week', () => {
    let s = rollGoals(INITIAL_GOALS, 100, 20);
    s = recordPulls(s, Array(70).fill('quartz'));
    s = claimGoal(s, 'w-pulls')!.state;
    expect(rollGoals(s, 101, 20).claimed).toContain('w-pulls');
    const nextWeek = rollGoals(s, 107, 21);
    expect(nextWeek.weeklyPulls).toBe(0);
    expect(nextWeek.claimed).not.toContain('w-pulls');
  });

  it('is idempotent', () => {
    const s = recordPulls(rollGoals(INITIAL_GOALS, 100, 20), ['ruby']);
    expect(rollGoals(s, 100, 20)).toEqual(s);
  });
});
