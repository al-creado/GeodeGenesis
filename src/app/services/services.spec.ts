import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { createSequenceRng } from '../core/rng';
import { SaveData } from '../core/save';
import { AdPlacement, AdService, NoAdsService, SimulatedAdService } from './ad.service';
import { GameStateService } from './game-state.service';
import { LocalStorageSaveService, SAVE_KEY, SaveService } from './save.service';
import { CLOCK, RNG } from './tokens';

const E = GAME_CONFIG.economy;
const H = 3_600_000;
const T0 = 1_700_000_000_000;

class MemorySave extends SaveService {
  stored: unknown = null;
  saves = 0;
  override load(): unknown { return this.stored; }
  override save(d: SaveData): void { this.stored = JSON.parse(JSON.stringify(d)); this.saves++; }
  override clear(): void { this.stored = null; }
}

class FakeAds extends AdService {
  available = true;
  /** What the next ad returns: true = reward callback fired. */
  reward = true;
  shown: AdPlacement[] = [];
  override isAvailable(): boolean { return this.available; }
  override async showRewarded(p: AdPlacement): Promise<boolean> { this.shown.push(p); return this.reward; }
}

/** Test-only: overwrite part of a service's private state. */
function patch(g: GameStateService, p: Partial<SaveData>): void {
  const internal = g as unknown as { state: WritableSignal<SaveData> };
  internal.state.update((s) => ({ ...s, ...p }));
}

describe('GameStateService', () => {
  let now: number;
  let storage: MemorySave;
  let ads: FakeAds;
  let rngValues: number[];

  function setup(): GameStateService {
    TestBed.configureTestingModule({
      providers: [
        { provide: SaveService, useValue: storage },
        { provide: AdService, useValue: ads },
        { provide: CLOCK, useValue: () => now },
        { provide: RNG, useValue: createSequenceRng(rngValues) },
      ],
    });
    return TestBed.inject(GameStateService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    now = T0;
    storage = new MemorySave();
    ads = new FakeAds();
    rngValues = [0]; // always Quartz index 0 (Pebble) until pity
  });

  it('starts a new game with starting coins', () => {
    const g = setup();
    expect(g.coins()).toBe(E.startingCoins);
    expect(g.ownedCount()).toBe(0);
    expect(g.luck()).toBe(0);
  });

  describe('cracking', () => {
    it('charges the cost, grants the post-crack bonus, and records the pull', () => {
      const g = setup();
      const b = g.crack(1)!;
      expect(b.results).toHaveLength(1);
      expect(g.coins()).toBe(E.startingCoins - E.crackCost1 + E.postCrackBonus);
      expect(g.ownedCount()).toBe(1);
      expect(g.totalCracks()).toBe(1);
      expect(g.pity().sinceEmerald).toBe(1);
    });

    it('x10 costs the discounted price', () => {
      const g = setup();
      patch(g, { coins: 2000 });
      g.crack(10);
      expect(g.coins()).toBe(2000 - E.crackCost10 + 10 * E.postCrackBonus);
      expect(g.totalCracks()).toBe(10);
    });

    it('refuses when the player cannot afford it', () => {
      const g = setup();
      patch(g, { coins: E.crackCost1 - 1 });
      expect(g.crack(1)).toBeNull();
      expect(g.coins()).toBe(E.crackCost1 - 1);
      expect(g.totalCracks()).toBe(0);
    });

    it('turns max-level duplicates into shards', () => {
      const g = setup();
      patch(g, { coins: 5000, collection: { pebble: { level: 10 } } });
      g.crack(1);
      expect(g.shards()).toBe(GAME_CONFIG.duplicates.shardsPerDuplicate.quartz);
    });

    it('persists after every change', () => {
      const g = setup();
      g.crack(1);
      expect((storage.stored as SaveData).totalCracks).toBe(1);
    });
  });

  describe('rewarded ads', () => {
    it('doubles the post-crack bonus only after the reward fires', async () => {
      const g = setup();
      g.crack(1);
      const before = g.coins();
      ads.reward = false;
      expect(await g.boostCrackBonus()).toBe(0);
      expect(g.coins()).toBe(before);
      ads.reward = true;
      expect(await g.boostCrackBonus()).toBe(E.postCrackBonus);
      expect(g.coins()).toBe(before + E.postCrackBonus);
      expect(await g.boostCrackBonus()).toBe(0); // only once per batch
    });

    it('never changes pull odds or luck', async () => {
      const g = setup();
      const oddsBefore = g.odds();
      await g.collectIdle(true);
      await g.claimDaily(true);
      g.crack(1);
      await g.boostCrackBonus();
      expect(g.odds()).toEqual(oddsBefore);
      expect(g.luck()).toBe(0);
    });

    it('is not offered when ads are disabled or unavailable', async () => {
      const g = setup();
      now += 2 * H;
      g.refreshClock();
      g.setAdsEnabled(false);
      expect(g.adsAvailable()).toBe(false);
      expect(await g.collectIdle(true)).toBe(0);
      expect(ads.shown).toEqual([]);
      g.setAdsEnabled(true);
      ads.available = false;
      expect(g.adsAvailable()).toBe(false);
    });
  });

  describe('idle income', () => {
    it('accrues over time and collects with a reset timer', async () => {
      const g = setup();
      expect(g.idleCoins()).toBe(0);
      now += 2 * H;
      g.refreshClock();
      expect(g.idleCoins()).toBe(2 * E.idleCoinsPerHour);
      expect(await g.collectIdle(false)).toBe(2 * E.idleCoinsPerHour);
      expect(g.idleCoins()).toBe(0);
      expect(g.coins()).toBe(E.startingCoins + 2 * E.idleCoinsPerHour);
    });

    it('caps at 8 hours', () => {
      const g = setup();
      now += 30 * H;
      g.refreshClock();
      expect(g.idleCoins()).toBe(E.idleCapHours * E.idleCoinsPerHour);
      expect(g.idleFill()).toBe(1);
      expect(g.idleMsLeft()).toBe(0);
    });

    it('multiplies by the ad multiplier when the ad rewards', async () => {
      const g = setup();
      now += 4 * H;
      g.refreshClock();
      ads.reward = false;
      expect(await g.collectIdle(true)).toBe(0);
      expect(g.idleCoins()).toBe(4 * E.idleCoinsPerHour); // untouched
      ads.reward = true;
      expect(await g.collectIdle(true)).toBe(4 * E.idleCoinsPerHour * E.adMultiplier);
      expect(ads.shown).toEqual(['idle', 'idle']);
    });

    it('does not show an ad when there is nothing to collect', async () => {
      const g = setup();
      expect(await g.collectIdle(true)).toBe(0);
      expect(ads.shown).toEqual([]);
    });
  });

  describe('daily bonus', () => {
    it('claims once per day', async () => {
      const g = setup();
      expect(await g.claimDaily(false)).toBe(E.dailyBonus[0]);
      expect(g.dailyNext().canClaim).toBe(false);
      expect(await g.claimDaily(false)).toBe(0);
    });

    it('is claimable again the next day, advancing the streak', async () => {
      const g = setup();
      await g.claimDaily(false);
      now += 24 * H;
      g.refreshClock();
      expect(g.dailyNext()).toEqual({ day: 2, canClaim: true });
      expect(await g.claimDaily(false)).toBe(E.dailyBonus[1]);
    });

    it('doubles with a rewarded ad and not otherwise', async () => {
      const g = setup();
      ads.reward = false;
      expect(await g.claimDaily(true)).toBe(0);
      expect(g.dailyNext().canClaim).toBe(true);
      ads.reward = true;
      expect(await g.claimDaily(true)).toBe(E.dailyBonus[0] * E.adMultiplier);
      expect(g.dailyRow()[0].state).toBe('claimed');
    });
  });

  describe('crew', () => {
    function withGems(g: GameStateService): void {
      patch(g, { collection: { pebble: { level: 1 }, plum: { level: 1 }, fern: { level: 1 }, ember: { level: 1 }, halo: { level: 1 } } });
    }

    it('adds owned gems, raising luck, and removes them', () => {
      const g = setup();
      withGems(g);
      expect(g.addToCrew('amethyst-ghost')).toBe(false);
      expect(g.addToCrew('plum')).toBe(true);
      expect(g.addToCrew('fern')).toBe(true);
      expect(g.addToCrew('ember')).toBe(true);
      expect(g.luck()).toBeCloseTo(0.035, 10); // 0.5% + 1% + 2%
      expect(g.odds().ruby).toBeCloseTo(2.55, 2);
      expect(g.addToCrew('pebble')).toBe(false); // 3 slots full
      expect(g.removeFromCrew('plum')).toBe(true);
      expect(g.luck()).toBeCloseTo(0.03, 10);
    });

    it('unlocks slots with shards', () => {
      const g = setup();
      withGems(g);
      expect(g.unlockCrewSlot()).toBe(false);
      patch(g, { shards: 60 });
      expect(g.unlockCrewSlot()).toBe(true);
      expect(g.crewSlots()).toBe(4);
      expect(g.shards()).toBe(60 - GAME_CONFIG.crew.slotUnlockShards[0]);
      expect(g.nextSlotCost()).toBe(GAME_CONFIG.crew.slotUnlockShards[1]);
    });
  });

  describe('saving', () => {
    it('restores progress into a new service instance', async () => {
      const g = setup();
      g.crack(1);
      g.addToCrew('pebble');
      const coins = g.coins();

      TestBed.resetTestingModule();
      const again = setup();
      expect(again.coins()).toBe(coins);
      expect(again.crew()).toEqual(['pebble']);
      expect(again.ownedCount()).toBe(1);
    });

    it('falls back to a new game on corrupt data', () => {
      storage.stored = { version: 999 };
      expect(setup().coins()).toBe(E.startingCoins);
    });

    it('reset wipes progress', () => {
      const g = setup();
      g.crack(1);
      g.resetProgress();
      expect(g.coins()).toBe(E.startingCoins);
      expect(g.ownedCount()).toBe(0);
      expect(g.lastBatch()).toBeNull();
    });
  });
});

describe('SimulatedAdService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rewards only after the full duration', async () => {
    const svc = new SimulatedAdService(GAME_CONFIG);
    let settled: boolean | null = null;
    void svc.showRewarded('idle').then((r) => (settled = r));
    expect(svc.dialog()?.placement).toBe('idle');

    await vi.advanceTimersByTimeAsync(GAME_CONFIG.ads.simulatedDurationMs - 200);
    expect(settled).toBeNull();
    expect(svc.dialog()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(true);
    expect(svc.dialog()).toBeNull();
  });

  it('gives no reward when the player closes it early', async () => {
    const svc = new SimulatedAdService(GAME_CONFIG);
    const p = svc.showRewarded('daily');
    await vi.advanceTimersByTimeAsync(1000);
    svc.cancel();
    expect(await p).toBe(false);
    expect(svc.dialog()).toBeNull();
    await vi.advanceTimersByTimeAsync(5000); // timer must be gone: no late reward
  });

  it('shows one ad at a time', async () => {
    const svc = new SimulatedAdService(GAME_CONFIG);
    void svc.showRewarded('idle');
    expect(await svc.showRewarded('daily')).toBe(false);
    svc.cancel();
  });
});

describe('NoAdsService', () => {
  it('is unavailable and never rewards', async () => {
    const svc = new NoAdsService();
    expect(svc.isAvailable()).toBe(false);
    expect(await svc.showRewarded()).toBe(false);
  });
});

describe('LocalStorageSaveService', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and clears', () => {
    const svc = new LocalStorageSaveService();
    expect(svc.load()).toBeNull();
    const data = { version: 1, coins: 5 } as unknown as SaveData;
    svc.save(data);
    expect(svc.load()).toEqual(data);
    svc.clear();
    expect(svc.load()).toBeNull();
  });

  it('returns null for unparseable data', () => {
    localStorage.setItem(SAVE_KEY, '{nope');
    expect(new LocalStorageSaveService().load()).toBeNull();
  });
});
