import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import {
  applyMultiplier,
  claimDaily,
  DailyState,
  dailyCells,
  dailyNext,
  INITIAL_DAILY,
  localDayNumber,
  localWeekNumber,
  postCrackBonus,
  rewardHasCoins,
  scaleReward,
} from './economy';

const H = 3_600_000;
const E = GAME_CONFIG.economy;

describe('multipliers and bonuses', () => {
  it('applies the ad multiplier', () => {
    expect(applyMultiplier(60, E.adMultiplier)).toBe(120);
    expect(applyMultiplier(7, 1)).toBe(7);
  });
  it('multiplies only the coins of a reward', () => {
    expect(scaleReward({ coins: 100 }, 2)).toEqual({ coins: 200 });
    expect(scaleReward({ coins: 100, shards: 5, tenTickets: 1 }, 2)).toEqual({ coins: 200, shards: 5, tenTickets: 1 });
    expect(scaleReward({ shards: 5 }, 2)).toEqual({ shards: 5 });
    expect(scaleReward({ tenTickets: 1 }, 3)).toEqual({ tenTickets: 1 });
  });
  it('knows whether a reward has coins', () => {
    expect(rewardHasCoins({ coins: 1 })).toBe(true);
    expect(rewardHasCoins({ tenTickets: 1 })).toBe(false);
    expect(rewardHasCoins({ coins: 0 })).toBe(false);
  });
  it('scales the post-crack bonus by cracks', () => {
    expect(postCrackBonus(1)).toBe(E.postCrackBonus);
    expect(postCrackBonus(10)).toBe(10 * E.postCrackBonus);
  });
});

describe('localDayNumber', () => {
  it('rolls over at local midnight', () => {
    const utcMidnight = 20_000 * 86_400_000;
    // UTC-5 (offset +300): 04:59 UTC is still the previous local day.
    expect(localDayNumber(utcMidnight + 4 * H + 59 * 60_000, 300)).toBe(19_999);
    expect(localDayNumber(utcMidnight + 5 * H, 300)).toBe(20_000);
    expect(localDayNumber(utcMidnight, 0)).toBe(20_000);
  });
});

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    // epoch day 0 was a Thursday; day 4 is the next Monday.
    expect(localWeekNumber(0)).toBe(localWeekNumber(3)); // Thu..Sun
    expect(localWeekNumber(4)).toBe(localWeekNumber(0) + 1); // Monday starts a new week
    expect(localWeekNumber(4)).toBe(localWeekNumber(10)); // Mon..Sun
    expect(localWeekNumber(11)).toBe(localWeekNumber(4) + 1);
  });
});

describe('login calendar', () => {
  it('starts on day 1 and pays that day', () => {
    const r = claimDaily(INITIAL_DAILY, 100)!;
    expect(r.day).toBe(1);
    expect(r.reward).toEqual(E.streakRewards[0]);
    expect(r.daily).toEqual({ claimedDay: 1, lastClaimDay: 100 });
  });

  it('pays the configured reward on day 4', () => {
    let d: DailyState = INITIAL_DAILY;
    let last = null;
    for (let day = 0; day < 4; day++) {
      last = claimDaily(d, 100 + day)!;
      d = last.daily;
    }
    expect(last!.day).toBe(4);
    expect(last!.reward).toEqual(E.streakRewards[3]);
  });

  it('cannot be claimed twice on the same day', () => {
    const first = claimDaily(INITIAL_DAILY, 100)!;
    expect(claimDaily(first.daily, 100)).toBeNull();
    expect(dailyNext(first.daily, 100).canClaim).toBe(false);
  });

  it('advances through the calendar and wraps after day 7', () => {
    let d: DailyState = INITIAL_DAILY;
    const days: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = claimDaily(d, 100 + i)!;
      days.push(r.day);
      d = r.daily;
    }
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
  });

  it('is forgiving: a missed day does not reset the calendar', () => {
    const d = claimDaily(claimDaily(INITIAL_DAILY, 100)!.daily, 101)!.daily; // claimed day 2
    expect(claimDaily(d, 110)!.day).toBe(3);
  });

  it('builds the 7-cell row', () => {
    const d: DailyState = { claimedDay: 3, lastClaimDay: 100 };
    // later the same day: nothing available, 3 claimed
    expect(dailyCells(d, 100).map((c) => c.state)).toEqual([
      'claimed', 'claimed', 'claimed', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // any later day, even after missing some: day 4 is available and earlier days stay lit
    for (const day of [101, 105, 200]) {
      expect(dailyCells(d, day).map((c) => c.state)).toEqual([
        'claimed', 'claimed', 'claimed', 'available', 'upcoming', 'upcoming', 'upcoming',
      ]);
    }
    // after a finished week the calendar starts again
    expect(dailyCells({ claimedDay: 7, lastClaimDay: 100 }, 101).map((c) => c.state)[0]).toBe('available');
    expect(dailyCells({ claimedDay: 7, lastClaimDay: 100 }, 101).filter((c) => c.state === 'claimed')).toHaveLength(0);
    expect(dailyCells({ claimedDay: 7, lastClaimDay: 100 }, 100).filter((c) => c.state === 'claimed')).toHaveLength(7);
    expect(dailyCells(INITIAL_DAILY, 100)[0].state).toBe('available');
    expect(dailyCells(d, 101).map((c) => c.reward)).toEqual([...E.streakRewards]);
  });
});
