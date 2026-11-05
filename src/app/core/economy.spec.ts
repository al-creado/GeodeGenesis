import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import {
  applyMultiplier,
  claimDaily,
  DailyState,
  dailyCells,
  dailyNext,
  idleAccrued,
  idleFillFraction,
  idleMsUntilFull,
  INITIAL_DAILY,
  localDayNumber,
  postCrackBonus,
} from './economy';

const H = 3_600_000;
const E = GAME_CONFIG.economy;

describe('idle income', () => {
  it('accrues per hour', () => {
    expect(idleAccrued(0, 2 * H)).toBe(2 * E.idleCoinsPerHour);
  });
  it('floors partial coins', () => {
    expect(idleAccrued(0, 1)).toBe(0);
  });
  it('caps at the idle cap', () => {
    const cap = E.idleCapHours * E.idleCoinsPerHour;
    expect(idleAccrued(0, E.idleCapHours * H)).toBe(cap);
    expect(idleAccrued(0, 100 * H)).toBe(cap);
  });
  it('never goes negative if the clock moves backwards', () => {
    expect(idleAccrued(10 * H, 0)).toBe(0);
  });
  it('reports fill fraction and time until full', () => {
    expect(idleFillFraction(0, (E.idleCapHours / 2) * H)).toBeCloseTo(0.5);
    expect(idleFillFraction(0, 99 * H)).toBe(1);
    expect(idleMsUntilFull(0, 2 * H)).toBe((E.idleCapHours - 2) * H);
    expect(idleMsUntilFull(0, 99 * H)).toBe(0);
  });
});

describe('multipliers and bonuses', () => {
  it('applies the ad multiplier', () => {
    expect(applyMultiplier(60, E.adMultiplier)).toBe(120);
    expect(applyMultiplier(7, 1)).toBe(7);
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

describe('daily bonus', () => {
  it('starts on day 1 and pays that day', () => {
    const r = claimDaily(INITIAL_DAILY, 100)!;
    expect(r.day).toBe(1);
    expect(r.coins).toBe(E.dailyBonus[0]);
    expect(r.daily).toEqual({ claimedDay: 1, lastClaimDay: 100 });
  });

  it('pays 60 coins on day 4', () => {
    let d: DailyState = INITIAL_DAILY;
    let last = null;
    for (let day = 0; day < 4; day++) {
      last = claimDaily(d, 100 + day)!;
      d = last.daily;
    }
    expect(last!.day).toBe(4);
    expect(last!.coins).toBe(60);
  });

  it('cannot be claimed twice on the same day', () => {
    const first = claimDaily(INITIAL_DAILY, 100)!;
    expect(claimDaily(first.daily, 100)).toBeNull();
    expect(dailyNext(first.daily, 100).canClaim).toBe(false);
  });

  it('continues the streak on consecutive days and wraps after day 7', () => {
    let d: DailyState = INITIAL_DAILY;
    const days: number[] = [];
    for (let i = 0; i < 9; i++) {
      const r = claimDaily(d, 100 + i)!;
      days.push(r.day);
      d = r.daily;
    }
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
  });

  it('resets to day 1 after a missed day', () => {
    const d = claimDaily(claimDaily(INITIAL_DAILY, 100)!.daily, 101)!.daily; // claimed day 2
    expect(claimDaily(d, 103)!.day).toBe(1);
  });

  it('builds the 7-cell row', () => {
    const d: DailyState = { claimedDay: 3, lastClaimDay: 100 };
    // later the same day: nothing available, 3 claimed
    expect(dailyCells(d, 100).map((c) => c.state)).toEqual([
      'claimed', 'claimed', 'claimed', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // next day: day 4 available
    expect(dailyCells(d, 101).map((c) => c.state)).toEqual([
      'claimed', 'claimed', 'claimed', 'available', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // streak broken: day 1 available, rest upcoming
    expect(dailyCells(d, 105).map((c) => c.state)).toEqual([
      'available', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // after a finished cycle the next claim is day 1 again
    expect(dailyCells({ claimedDay: 7, lastClaimDay: 100 }, 101)[0].state).toBe('available');
    expect(dailyCells(INITIAL_DAILY, 100)[0].state).toBe('available');
    expect(dailyCells(d, 101).map((c) => c.coins)).toEqual([...E.dailyBonus]);
  });
});
