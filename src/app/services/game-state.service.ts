import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { addToCrew, crewRarities, nextSlotCost, removeFromCrew, unlockSlot } from '../core/crew';
import {
  applyMultiplier,
  claimDaily,
  dailyCells,
  dailyNext,
  idleAccrued,
  idleFillFraction,
  idleMsUntilFull,
  localDayNumber,
  postCrackBonus,
} from '../core/economy';
import { adjustedOdds, computeLuck } from '../core/odds';
import { CrackResult } from '../core/pull';
import { createNewSave, migrateSave, SaveData } from '../core/save';
import { ROSTER } from '../core/roster';
import { AdPlacement, AdService } from './ad.service';
import { PullService } from './pull.service';
import { SaveService } from './save.service';
import { CLOCK, CONFIG } from './tokens';

/** How many geodes one crack button opens. */
export type CrackCount = 1 | 10;

export interface LastBatch {
  readonly count: CrackCount;
  readonly results: readonly CrackResult[];
  /** Coins already granted as the post-crack bonus. */
  readonly bonus: number;
  /** True once a rewarded ad has doubled the bonus. */
  readonly bonusBoosted: boolean;
}

/** The single source of truth for player progress. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly config = inject(CONFIG);
  private readonly storage = inject(SaveService);
  private readonly ads = inject(AdService);
  private readonly pulls = inject(PullService);
  private readonly clock = inject(CLOCK);

  private readonly state = signal<SaveData>(this.loadInitial());
  private readonly nowMs = signal(this.clock());

  readonly coins = computed(() => this.state().coins);
  readonly shards = computed(() => this.state().shards);
  readonly collection = computed(() => this.state().collection);
  readonly pity = computed(() => this.state().pity);
  readonly crew = computed(() => this.state().crew);
  readonly crewSlots = computed(() => this.state().crewSlots);
  readonly totalCracks = computed(() => this.state().totalCracks);
  readonly adsEnabled = computed(() => this.state().settings.adsEnabled);

  readonly ownedCount = computed(() => Object.keys(this.state().collection).length);
  readonly rosterSize = ROSTER.length;

  readonly luck = computed(() => computeLuck(crewRarities(this.crew(), ROSTER), this.config));
  readonly odds = computed(() => adjustedOdds(this.luck(), this.config));
  readonly baseOdds = adjustedOdds(0, this.config);

  /** Whether the UI should offer rewarded ads right now. */
  readonly adsAvailable = computed(() => this.adsEnabled() && this.ads.isAvailable());
  /** True while an ad is playing, to block double taps. */
  readonly adBusy = signal(false);

  readonly lastBatch = signal<LastBatch | null>(null);

  /** The full save as it stands now (read-only; used by cloud sync). */
  readonly snapshot = this.state.asReadonly();

  // Idle income
  readonly idleCoins = computed(() => idleAccrued(this.state().lastIdleCollect, this.nowMs(), this.config));
  readonly idleFill = computed(() => idleFillFraction(this.state().lastIdleCollect, this.nowMs(), this.config));
  readonly idleMsLeft = computed(() => idleMsUntilFull(this.state().lastIdleCollect, this.nowMs(), this.config));

  // Daily bonus
  private readonly today = computed(() => localDayNumber(this.nowMs(), new Date(this.nowMs()).getTimezoneOffset()));
  readonly dailyRow = computed(() => dailyCells(this.state().daily, this.today(), this.config));
  readonly dailyNext = computed(() => dailyNext(this.state().daily, this.today(), this.config));

  // Crew
  readonly nextSlotCost = computed(() => nextSlotCost(this.crewSlots(), this.config));

  /** Refresh "now" so idle and daily displays update. Call on a timer and on app resume. */
  refreshClock(): void {
    this.nowMs.set(this.clock());
  }

  /** Start a 1-second UI clock that stops when `destroyRef` is destroyed. */
  startClock(destroyRef: DestroyRef): void {
    const id = setInterval(() => this.refreshClock(), 1000);
    const onVisible = (): void => this.refreshClock();
    document.addEventListener('visibilitychange', onVisible);
    destroyRef.onDestroy(() => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  cost(count: CrackCount): number {
    return count === 1 ? this.config.economy.crackCost1 : this.config.economy.crackCost10;
  }

  canAfford(count: CrackCount): boolean {
    return this.coins() >= this.cost(count);
  }

  /** Crack geodes. Returns null if the player can't afford it. */
  crack(count: CrackCount): LastBatch | null {
    if (!this.canAfford(count)) return null;
    const s = this.state();
    const batch = this.pulls.crack(count, s.collection, s.pity, this.luck());
    const bonus = postCrackBonus(count, this.config);
    this.commit({
      ...s,
      coins: s.coins - this.cost(count) + bonus,
      shards: s.shards + batch.shardsGained,
      collection: batch.collection,
      pity: batch.pity,
      totalCracks: s.totalCracks + count,
    });
    const result: LastBatch = { count, results: batch.results, bonus, bonusBoosted: false };
    this.lastBatch.set(result);
    return result;
  }

  /** Watch an ad to multiply the post-crack bonus. Returns the extra coins granted. */
  async boostCrackBonus(): Promise<number> {
    const batch = this.lastBatch();
    if (!batch || batch.bonusBoosted || !(await this.watchAd('postCrack'))) return 0;
    const extra = applyMultiplier(batch.bonus, this.config.economy.adMultiplier) - batch.bonus;
    this.addCoins(extra);
    this.lastBatch.set({ ...batch, bonusBoosted: true });
    return extra;
  }

  /** Collect idle coins, optionally multiplied by a rewarded ad. Returns coins gained. */
  async collectIdle(withAd: boolean): Promise<number> {
    if (this.idleCoins() <= 0) return 0;
    const multiplier = withAd ? await this.adMultiplier('idle') : 1;
    if (multiplier === 0) return 0;
    const now = this.clock();
    const gained = applyMultiplier(idleAccrued(this.state().lastIdleCollect, now, this.config), multiplier);
    this.commit({ ...this.state(), coins: this.state().coins + gained, lastIdleCollect: now });
    this.nowMs.set(now);
    return gained;
  }

  /** Claim the daily bonus, optionally multiplied by a rewarded ad. Returns coins gained. */
  async claimDaily(withAd: boolean): Promise<number> {
    if (!this.dailyNext().canClaim) return 0;
    const multiplier = withAd ? await this.adMultiplier('daily') : 1;
    if (multiplier === 0) return 0;
    const now = this.clock();
    const claim = claimDaily(this.state().daily, localDayNumber(now, new Date(now).getTimezoneOffset()), this.config);
    if (!claim) return 0;
    const gained = applyMultiplier(claim.coins, multiplier);
    this.commit({ ...this.state(), coins: this.state().coins + gained, daily: claim.daily });
    this.nowMs.set(now);
    return gained;
  }

  addToCrew(gemId: string): boolean {
    const s = this.state();
    const r = addToCrew(s.crew, gemId, s.crewSlots, s.collection);
    if (!r.ok) return false;
    this.commit({ ...s, crew: r.crew });
    return true;
  }

  removeFromCrew(gemId: string): boolean {
    const r = removeFromCrew(this.state().crew, gemId);
    if (!r.ok) return false;
    this.commit({ ...this.state(), crew: r.crew });
    return true;
  }

  /** Spend shards to unlock the next crew slot. */
  unlockCrewSlot(): boolean {
    const s = this.state();
    const r = unlockSlot(s.crewSlots, s.shards, this.config);
    if (!r) return false;
    this.commit({ ...s, crewSlots: r.slots, shards: r.shards });
    return true;
  }

  setAdsEnabled(enabled: boolean): void {
    this.commit({ ...this.state(), settings: { ...this.state().settings, adsEnabled: enabled } });
  }

  /** Wipe all progress and start over. */
  resetProgress(): void {
    this.storage.clear();
    this.lastBatch.set(null);
    this.state.set({ ...createNewSave(this.clock(), this.config), savedAt: this.clock() });
    this.storage.save(this.state());
    this.refreshClock();
  }

  /** Replace progress with a save from elsewhere (cloud). The data must already be validated. */
  importSave(data: SaveData): void {
    this.lastBatch.set(null);
    this.commit(data, false);
    this.refreshClock();
  }

  /** Runs an ad; returns the configured multiplier if rewarded, else 0 (no reward). */
  private async adMultiplier(placement: AdPlacement): Promise<number> {
    return (await this.watchAd(placement)) ? this.config.economy.adMultiplier : 0;
  }

  private async watchAd(placement: AdPlacement): Promise<boolean> {
    if (!this.adsAvailable() || this.adBusy()) return false;
    this.adBusy.set(true);
    try {
      return await this.ads.showRewarded(placement);
    } finally {
      this.adBusy.set(false);
    }
  }

  private addCoins(amount: number): void {
    this.commit({ ...this.state(), coins: this.state().coins + amount });
  }

  /** Store a change locally. `touch` stamps savedAt so cloud sync can tell which save is newest. */
  private commit(next: SaveData, touch = true): void {
    const saved = touch ? { ...next, savedAt: this.clock() } : next;
    this.state.set(saved);
    this.storage.save(saved);
  }

  private loadInitial(): SaveData {
    const now = this.clock();
    return migrateSave(this.storage.load(), now, this.config) ?? createNewSave(now, this.config);
  }
}
