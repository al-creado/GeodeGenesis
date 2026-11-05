import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { localDayNumber } from '../core/economy';
import { Collection } from '../core/pull';
import { createSequenceRng } from '../core/rng';
import { ROSTER } from '../core/roster';
import { createNewSave, SaveData } from '../core/save';
import { AdPlacement, AdService, NoAdsService, SimulatedAdService } from './ad.service';
import { GameStateService } from './game-state.service';
import { ToastService } from './toast.service';
import { LocalStorageSaveService, SAVE_KEY, SaveService } from './save.service';
import { CLOCK, CONFIG, RNG } from './tokens';

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

  function setup(seed?: Partial<SaveData>): GameStateService {
    if (seed) storage.stored = { ...createNewSave(T0), ...seed };
    TestBed.configureTestingModule({
      providers: [
        { provide: SaveService, useValue: storage },
        { provide: AdService, useValue: ads },
        { provide: CONFIG, useValue: GAME_CONFIG },
        { provide: CLOCK, useValue: () => now },
        { provide: RNG, useValue: createSequenceRng(rngValues) },
      ],
    });
    return TestBed.inject(GameStateService);
  }

  const advanceDays = (g: GameStateService, days: number): void => {
    now += days * 24 * H;
    g.refreshClock();
  };
  const dayOf = (ms: number): number => localDayNumber(ms, new Date(ms).getTimezoneOffset());
  /** A player who has already made their first pull, so pulls cost coins. */
  const played = (extra: Partial<SaveData> = {}): Partial<SaveData> => ({ totalCracks: 5, collection: { pebble: { level: 1 } }, ...extra });
  const own = (ids: string[], level = 1): Collection => Object.fromEntries(ids.map((id) => [id, { level }]));

  beforeEach(() => {
    TestBed.resetTestingModule();
    now = T0;
    storage = new MemorySave();
    ads = new FakeAds();
    rngValues = [0]; // always Quartz index 0 (Pebble) until pity
  });

  it('starts a new game with starting coins and everything locked', () => {
    const g = setup();
    expect(g.coins()).toBe(E.startingCoins);
    expect(g.ownedCount()).toBe(0);
    expect(g.luck()).toBe(0);
    expect(g.unlocks()).toEqual({ vault: false, daily: false, crew: false, shop: false, pity: false });
  });

  describe('first pull', () => {
    it('is free, then pulls cost coins', () => {
      const g = setup();
      expect(g.firstPullFree()).toBe(true);
      expect(g.cost(1)).toBe(0);
      expect(g.cost(10)).toBe(E.crackCost10); // only the first single pull is free
      g.crack(1);
      expect(g.coins()).toBe(E.startingCoins); // free: no cost and no bonus
      expect(g.firstPullFree()).toBe(false);
      expect(g.cost(1)).toBe(E.crackCost1);
    });

    it('unlocks Vault and Daily, and says so', () => {
      const g = setup();
      const b = g.crack(1)!;
      expect(b.unlocked).toEqual(expect.arrayContaining(['vault', 'daily']));
      expect(g.unlocks().vault).toBe(true);
      expect(g.unlocks().daily).toBe(true);
      expect(g.unlocks().crew).toBe(false);
    });

    it('unlocks Crew with the first Emerald or better (guaranteed by pity within 10 pulls)', () => {
      const g = setup({ ...played({ coins: 5000 }), pity: { sinceEmerald: 9, sinceRuby: 9 } });
      expect(g.unlocks().crew).toBe(false);
      const b = g.crack(1)!;
      expect(b.results[0].gem.rarity).toBe('emerald');
      expect(b.unlocked).toContain('crew');
      expect(g.unlocks().crew).toBe(true);
    });

    it('unlocks the shop and pity bars after enough pulls', () => {
      const g = setup(played({ coins: 5000, totalCracks: GAME_CONFIG.unlocks.shopAfterPulls - 1 }));
      expect(g.unlocks().shop).toBe(false);
      g.crack(1);
      expect(g.unlocks().shop).toBe(true);
      expect(g.unlocks().pity).toBe(true);
    });
  });

  describe('paid pulls', () => {
    it('charges the cost, grants the post-pull bonus, and records the pull', () => {
      const g = setup(played());
      const b = g.crack(1)!;
      expect(b.results).toHaveLength(1);
      expect(g.coins()).toBe(E.startingCoins - E.crackCost1 + E.postCrackBonus);
      expect(g.totalCracks()).toBe(6);
      expect(g.pity().sinceEmerald).toBe(1);
    });

    it('x10 costs the discounted price', () => {
      const g = setup(played({ coins: 2000 }));
      g.crack(10);
      expect(g.coins()).toBe(2000 - E.crackCost10 + 10 * E.postCrackBonus);
      expect(g.totalCracks()).toBe(15);
    });

    it('refuses when the player cannot afford it', () => {
      const g = setup(played({ coins: E.crackCost1 - 1 }));
      expect(g.crack(1)).toBeNull();
      expect(g.coins()).toBe(E.crackCost1 - 1);
      expect(g.totalCracks()).toBe(5);
    });

    it('turns max-level duplicates into shards', () => {
      const g = setup(played({ coins: 5000, collection: { pebble: { level: 10 } } }));
      g.crack(1);
      expect(g.shards()).toBe(GAME_CONFIG.duplicates.shardsPerDuplicate.quartz);
    });

    it('persists after every change', () => {
      const g = setup(played());
      g.crack(1);
      expect((storage.stored as SaveData).totalCracks).toBe(6);
    });
  });

  describe('free daily pull', () => {
    it('costs nothing, gives no bonus, and is limited to once a day', () => {
      const g = setup(played());
      expect(g.freePullReady()).toBe(true);
      const b = g.crack(1, 'daily')!;
      expect(b.source).toBe('daily');
      expect(b.bonus).toBe(0);
      expect(g.coins()).toBe(E.startingCoins);
      expect(g.freePullReady()).toBe(false);
      expect(g.crack(1, 'daily')).toBeNull();
      advanceDays(g, 1);
      expect(g.freePullReady()).toBe(true);
      expect(g.crack(1, 'daily')).not.toBeNull();
    });

    it('only works for a single pull', () => {
      const g = setup(played());
      expect(g.crack(10, 'daily')).toBeNull();
    });
  });

  describe('free x10 tickets', () => {
    it('spends a ticket, costs no coins, and counts as ten pulls', () => {
      const g = setup(played({ tenTickets: 2 }));
      const b = g.crack(10, 'ticket')!;
      expect(b.results).toHaveLength(10);
      expect(g.tenTickets()).toBe(1);
      expect(g.coins()).toBe(E.startingCoins);
      expect(b.bonus).toBe(0);
      expect(g.totalCracks()).toBe(15);
    });

    it('refuses with no tickets, or for a single pull', () => {
      expect(setup(played()).crack(10, 'ticket')).toBeNull();
      TestBed.resetTestingModule();
      expect(setup(played({ tenTickets: 1 })).crack(1, 'ticket')).toBeNull();
    });
  });

  describe('login calendar', () => {
    it('pays day 1, then waits until tomorrow', async () => {
      const g = setup(played());
      const r = await g.claimStreak(false);
      expect(r).toEqual(E.streakRewards[0]);
      expect(g.coins()).toBe(E.startingCoins + (E.streakRewards[0].coins ?? 0));
      expect(g.dailyNext().canClaim).toBe(false);
      expect(await g.claimStreak(false)).toBeNull();
    });

    it('moves on to day 2 the next day, and a missed day does not reset it', async () => {
      const g = setup(played());
      await g.claimStreak(false);
      advanceDays(g, 3); // missed two days
      expect(g.dailyNext()).toEqual({ day: 2, canClaim: true });
      expect(await g.claimStreak(false)).toEqual(E.streakRewards[1]);
    });

    it('doubles the coins with a rewarded ad, and gives nothing if the ad is not rewarded', async () => {
      const g = setup(played());
      ads.reward = false;
      expect(await g.claimStreak(true)).toBeNull();
      expect(g.dailyNext().canClaim).toBe(true);
      ads.reward = true;
      const r = await g.claimStreak(true);
      expect(r).toEqual({ coins: (E.streakRewards[0].coins ?? 0) * E.adMultiplier });
      expect(g.dailyRow()[0].state).toBe('claimed');
    });

    it('does not offer an ad on a day with no coins (day 7 pays a ticket)', async () => {
      const g = setup(played({ daily: { claimedDay: 6, lastClaimDay: dayOf(T0) - 1 } }));
      expect(await g.claimStreak(true)).toBeNull();
      expect(ads.shown).toEqual([]);
      expect(await g.claimStreak(false)).toEqual({ tenTickets: 1 });
      expect(g.tenTickets()).toBe(1);
    });
  });

  describe('goals', () => {
    it('counts pulls toward goals, then pays each goal once', () => {
      const g = setup(played({ coins: 5000 }));
      const view = (id: string) => g.goals().find((v) => v.def.id === id)!;
      expect(view('d-pulls').progress).toBe(0);
      g.crack(10);
      expect(view('d-pulls')).toMatchObject({ progress: 10, done: true, claimed: false });
      expect(view('w-pulls').progress).toBe(10);
      const before = g.coins();
      expect(g.claimGoal('d-pulls')).toEqual({ coins: 100 });
      expect(g.coins()).toBe(before + 100);
      expect(g.claimGoal('d-pulls')).toBeNull();
      expect(g.claimGoal('w-pulls')).toBeNull(); // not finished: 10 of 70
      // pity forced an Emerald or better on pull 10, which counts as a rare find
      expect(g.claimGoal('d-rare')).toEqual({ shards: 5 });
    });

    it('free pulls count too, and daily goals reset the next day', () => {
      const g = setup(played({ coins: 5000 }));
      g.crack(1, 'daily');
      expect(g.goals().find((v) => v.def.id === 'd-pulls')!.progress).toBe(1);
      advanceDays(g, 1);
      expect(g.goals().find((v) => v.def.id === 'd-pulls')!.progress).toBe(0);
    });

    it('pays a weekly ticket after enough pulls in the week', () => {
      const g = setup(played({ coins: 100000, tenTickets: 0 }));
      for (let i = 0; i < 7; i++) g.crack(10);
      expect(g.goals().find((v) => v.def.id === 'w-pulls')).toMatchObject({ progress: 70, done: true });
      expect(g.claimGoal('w-pulls')).toEqual({ tenTickets: 1 });
      expect(g.tenTickets()).toBe(1);
    });
  });

  describe('collection rewards and sets', () => {
    it('claims a reached milestone once and pays it', () => {
      const g = setup(played({ collection: own(['pebble', 'frost', 'honey', 'dewdrop', 'mochi', 'pip']) }));
      const before = g.coins();
      expect(g.claimMilestone(6)).toEqual({ coins: 200 });
      expect(g.coins()).toBe(before + 200);
      expect(g.claimMilestone(6)).toBeNull();
      expect(g.claimMilestone(12)).toBeNull(); // not reached
    });

    it('a claimed luck milestone adds permanent luck, an unclaimed one does not', () => {
      const ids = ROSTER.slice(0, 18).map((g) => g.id);
      const g = setup(played({ collection: own(ids), claimedMilestones: [6, 12] }));
      const base = g.luck();
      expect(g.claimMilestone(18)).toEqual({ luck: 0.005 });
      expect(g.luckParts().milestones).toBeCloseTo(0.005, 10);
      expect(g.luck()).toBeCloseTo(base + 0.005, 10);
    });

    it('completed sets add permanent luck', () => {
      const amethyst = ROSTER.filter((x) => x.rarity === 'amethyst').map((x) => x.id);
      const g = setup(played({ collection: own(amethyst) }));
      expect(g.luckParts().sets).toBeCloseTo(GAME_CONFIG.progression.setBonuses.amethyst, 10);
      const partial = (TestBed.resetTestingModule(), setup(played({ collection: own(amethyst.slice(1)) })));
      expect(partial.luckParts().sets).toBe(0);
    });

    it('luck from collecting never exceeds the cap', () => {
      const all = ROSTER.map((x) => x.id);
      const g = setup(played({ collection: own(all, 10), crew: ['halo', 'ember', 'cherry'], claimedMilestones: [6, 12, 18, 24] }));
      expect(g.luck()).toBe(GAME_CONFIG.crew.luckCap);
    });
  });

  describe('gem levels', () => {
    it('raise crew luck', () => {
      const lvl1 = setup(played({ collection: { plum: { level: 1 } }, crew: ['plum'] }));
      expect(lvl1.luck()).toBeCloseTo(0.005, 10);
      TestBed.resetTestingModule();
      const lvl5 = setup(played({ collection: { plum: { level: 5 } }, crew: ['plum'] }));
      expect(lvl5.luck()).toBeCloseTo(0.005 * 1.4, 10);
    });
  });

  describe('spark and exchange', () => {
    it('earns spark progress from every pull and lets you pick a gem when ready', () => {
      const g = setup(played({ coins: 5000 }));
      g.crack(10);
      expect(g.sparkProgress()).toBe(10);
      expect(g.chooseSparkGem('halo')).toBeNull();
      const r = (TestBed.resetTestingModule(), setup(played({ sparkProgress: GAME_CONFIG.shop.sparkAt + 4 })));
      expect(r.sparkIsReady()).toBe(true);
      const pick = r.chooseSparkGem('halo')!;
      expect(pick.outcome).toBe('new');
      expect(r.collection()['halo']).toEqual({ level: 1 });
      expect(r.sparkProgress()).toBe(4); // extra progress carries over
    });

    it('a spark does not touch pity', () => {
      const g = setup(played({ sparkProgress: 150, pity: { sinceEmerald: 7, sinceRuby: 30 } }));
      g.chooseSparkGem('halo');
      expect(g.pity()).toEqual({ sinceEmerald: 7, sinceRuby: 30 });
    });

    it('exchanges shards for a missing gem, once', () => {
      const g = setup(played({ shards: 100 }));
      expect(g.exchange('wisp')).toBe(true);
      expect(g.shards()).toBe(100 - GAME_CONFIG.shop.exchangeShards.amethyst);
      expect(g.collection()['wisp']).toEqual({ level: 1 });
      expect(g.exchange('wisp')).toBe(false); // already owned
      expect(g.exchange('halo')).toBe(false); // cannot afford
      expect(g.exchange('ghost')).toBe(false);
    });
  });

  describe('rewarded ads', () => {
    it('doubles the post-pull bonus only after the reward fires', async () => {
      const g = setup(played());
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

    it('offers no ad after a free pull (there is no bonus to double)', async () => {
      const g = setup(played());
      g.crack(1, 'daily');
      expect(await g.boostCrackBonus()).toBe(0);
      expect(ads.shown).toEqual([]);
    });

    it('never changes pull odds or luck', async () => {
      const g = setup(played());
      const oddsBefore = g.odds();
      await g.claimStreak(true);
      g.crack(1);
      await g.boostCrackBonus();
      expect(g.odds()).toEqual(oddsBefore);
      expect(g.luck()).toBe(0);
    });

    it('is not offered when ads are disabled or unavailable', async () => {
      const g = setup(played());
      g.setAdsEnabled(false);
      expect(g.adsAvailable()).toBe(false);
      expect(await g.claimStreak(true)).toBeNull();
      expect(ads.shown).toEqual([]);
      g.setAdsEnabled(true);
      ads.available = false;
      expect(g.adsAvailable()).toBe(false);
    });
  });

  describe('ad feedback', () => {
    it('tells the player when an ad gave no reward', async () => {
      const g = setup(played());
      const toast = TestBed.inject(ToastService);
      g.crack(1);
      ads.reward = false;
      await g.boostCrackBonus();
      expect(toast.message()).toContain('No reward');
    });

    it('stays quiet when the ad rewards', async () => {
      const g = setup(played());
      const toast = TestBed.inject(ToastService);
      g.crack(1);
      await g.boostCrackBonus();
      expect(toast.message()).toBeNull();
    });
  });

  describe('first-run intro', () => {
    it('shows for a new player and not again once completed', () => {
      const g = setup();
      expect(g.showIntro()).toBe(true);
      g.completeIntro();
      expect(g.showIntro()).toBe(false);
      expect((storage.stored as SaveData).settings.introSeen).toBe(true);
    });

    it('can be replayed from Settings without changing the saved flag', () => {
      const g = setup();
      g.completeIntro();
      g.replayIntro();
      expect(g.showIntro()).toBe(true);
      g.completeIntro();
      expect(g.showIntro()).toBe(false);
    });

    it('does not show for a returning player', () => {
      storage.stored = { version: 4, totalCracks: 5, collection: { pebble: { level: 1 } }, settings: { introSeen: true } };
      expect(setup().showIntro()).toBe(false);
    });
  });

  describe('crew', () => {
    const gems = { plum: { level: 1 }, fern: { level: 1 }, ember: { level: 1 }, pebble: { level: 1 }, frost: { level: 1 } };

    it('adds owned gems, raising luck, and removes them', () => {
      const g = setup(played({ collection: gems }));
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
      const g = setup(played({ collection: gems }));
      expect(g.unlockCrewSlot()).toBe(false);
      patch(g, { shards: 60 });
      expect(g.unlockCrewSlot()).toBe(true);
      expect(g.crewSlots()).toBe(4);
      expect(g.shards()).toBe(60 - GAME_CONFIG.crew.slotUnlockShards[0]);
      expect(g.nextSlotCost()).toBe(GAME_CONFIG.crew.slotUnlockShards[1]);
    });
  });

  describe('saving', () => {
    it('restores progress into a new service instance', () => {
      const g = setup(played());
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
      const g = setup(played());
      g.crack(1);
      g.resetProgress();
      expect(g.coins()).toBe(E.startingCoins);
      expect(g.ownedCount()).toBe(0);
      expect(g.lastBatch()).toBeNull();
      expect(g.unlocks().vault).toBe(false);
    });
  });
});

describe('SimulatedAdService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rewards only after the full duration', async () => {
    const svc = new SimulatedAdService(GAME_CONFIG);
    let settled: boolean | null = null;
    void svc.showRewarded('daily').then((r) => (settled = r));
    expect(svc.dialog()?.placement).toBe('daily');

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
    void svc.showRewarded('daily');
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
