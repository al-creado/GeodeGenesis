import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Rarity, Reward } from '../core/config';
import { addToCrew, nextSlotCost, removeFromCrew, unlockSlot } from '../core/crew';
import {
  applyMultiplier,
  claimDaily,
  dailyCells,
  dailyNext,
  localDayNumber,
  localWeekNumber,
  postCrackBonus,
  rewardHasCoins,
  scaleReward,
} from '../core/economy';
import { claimGoal, goalViews, recordPulls, rollGoals } from '../core/goals';
import { adjustedOdds, computeLuck } from '../core/odds';
import { crewTimerReduction, CrewPreview, previewCrewChange } from '../core/passives';
import { boostFreePull, effectiveCooldownMs, freePullRemainingMs } from '../core/timer';
import { claimMilestone, crewMembers, gemLuck, milestoneStates, permanentLuck, setStates } from '../core/progression';
import { CrackResult, DuplicateOutcome } from '../core/pull';
import { createNewSave, migrateSave, SaveData } from '../core/save';
import { findGem, GemDef, ROSTER } from '../core/roster';
import { claimSpark, exchangeGem, sparkReady } from '../core/shop';
import { bestRarity, computeUnlocks, Unlocks } from '../core/unlocks';
import { AdPlacement, AdService } from './ad.service';
import { PullService } from './pull.service';
import { SaveService } from './save.service';
import { ToastService } from './toast.service';
import { CLOCK, CONFIG } from './tokens';

/** How many gems one pull button gives. */
export type CrackCount = 1 | 10;

/** Where the payment for a pull comes from. */
export type PullSource = 'coins' | 'daily' | 'ticket';

export interface LastBatch {
  readonly count: CrackCount;
  readonly source: PullSource;
  readonly results: readonly CrackResult[];
  /** Coins already granted as the post-pull bonus (0 for free pulls). */
  readonly bonus: number;
  /** True once a rewarded ad has doubled the bonus. */
  readonly bonusBoosted: boolean;
  /** Tabs and features this pull unlocked. */
  readonly unlocked: readonly (keyof Unlocks)[];
}

export interface SparkResult {
  readonly gem: GemDef;
  readonly outcome: DuplicateOutcome;
  readonly level: number;
  readonly shardsGained: number;
}

/** The single source of truth for player progress. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly config = inject(CONFIG);
  private readonly storage = inject(SaveService);
  private readonly ads = inject(AdService);
  private readonly pulls = inject(PullService);
  private readonly clock = inject(CLOCK);
  private readonly toast = inject(ToastService);

  private readonly state = signal<SaveData>(this.loadInitial());
  private readonly nowMs = signal(this.clock());

  readonly coins = computed(() => this.state().coins);
  readonly shards = computed(() => this.state().shards);
  readonly tenTickets = computed(() => this.state().tenTickets);
  readonly collection = computed(() => this.state().collection);
  readonly pity = computed(() => this.state().pity);
  readonly crew = computed(() => this.state().crew);
  readonly crewSlots = computed(() => this.state().crewSlots);
  readonly totalCracks = computed(() => this.state().totalCracks);
  readonly sparkProgress = computed(() => this.state().sparkProgress);
  readonly adsEnabled = computed(() => this.state().settings.adsEnabled);
  readonly introSeen = computed(() => this.state().settings.introSeen);
  readonly cloudSaveEnabled = computed(() => this.state().settings.cloudSave);

  /** Set by "How to play" to show the intro again after it was dismissed. */
  private readonly introReplay = signal(false);
  /** Whether the intro overlay is on screen: first run, or replayed from Settings. */
  readonly showIntro = computed(() => !this.introSeen() || this.introReplay());

  readonly ownedCount = computed(() => Object.keys(this.state().collection).length);
  readonly rosterSize = ROSTER.length;

  /** What the player has unlocked so far (derived from progress). */
  readonly unlocks = computed(() => computeUnlocks(this.totalCracks(), bestRarity(this.collection(), ROSTER), this.config));
  /** True until the very first pull, which is free. */
  readonly firstPullFree = computed(() => this.totalCracks() === 0);

  /** Where total luck comes from. `total` is what pulls use (capped). */
  readonly luckParts = computed(() => {
    const members = crewMembers(this.crew(), this.collection(), ROSTER);
    const crew = members.reduce((a, m) => a + gemLuck(m.rarity, m.level, this.config), 0);
    const perm = permanentLuck(this.collection(), this.state().claimedMilestones, ROSTER, this.config);
    return { crew, sets: perm.sets, milestones: perm.milestones, total: computeLuck(members, this.config, perm.total) };
  });
  readonly luck = computed(() => this.luckParts().total);
  /** The crew's gems with their levels. */
  readonly crewMembers = computed(() => crewMembers(this.crew(), this.collection(), ROSTER));
  /** The crew's passive cut to the free-pull wait (capped). */
  readonly timerReduction = computed(() => crewTimerReduction(this.crewMembers(), this.config));
  readonly odds = computed(() => adjustedOdds(this.luck(), this.config));
  readonly baseOdds = adjustedOdds(0, this.config);

  /** Whether the UI should offer rewarded ads right now. */
  readonly adsAvailable = computed(() => this.adsEnabled() && this.ads.available());
  /** True when this build can show ads at all (the Android app). The browser has none. */
  readonly adsSupported = this.ads.supported;
  /** True while an ad is playing, to block double taps. */
  readonly adBusy = signal(false);

  readonly lastBatch = signal<LastBatch | null>(null);

  /** The full save as it stands now (read-only; used by cloud sync). */
  readonly snapshot = this.state.asReadonly();

  // Time-based things
  private readonly today = computed(() => this.dayOf(this.nowMs()));
  private readonly thisWeek = computed(() => localWeekNumber(this.today()));
  readonly dailyRow = computed(() => dailyCells(this.state().daily, this.today(), this.config));
  readonly dailyNext = computed(() => dailyNext(this.state().daily, this.today(), this.config));
  /** The free-pull wait after the crew's passive cut. */
  readonly freeCooldownMs = computed(() => effectiveCooldownMs(this.timerReduction(), this.config));
  readonly freePullRemainingMs = computed(() =>
    freePullRemainingMs({ lastAt: this.state().freePullAt, boostMs: this.state().freePullBoostMs }, this.nowMs(), this.freeCooldownMs()),
  );
  readonly freePullReady = computed(() => this.freePullRemainingMs() === 0);
  /** How far through the wait we are, 0..1. */
  readonly freePullFill = computed(() => 1 - Math.min(this.freePullRemainingMs() / this.freeCooldownMs(), 1));
  readonly canPayShardsForTimer = computed(() => !this.freePullReady() && this.shards() >= this.config.freePull.shardCost);

  // Goals, milestones, sets
  readonly goals = computed(() => goalViews(rollGoals(this.state().goals, this.today(), this.thisWeek(), this.config), this.config));
  readonly milestones = computed(() => milestoneStates(this.ownedCount(), this.state().claimedMilestones, this.config));
  readonly sets = computed(() => setStates(this.collection(), ROSTER, this.config));

  // Shop
  readonly sparkIsReady = computed(() => sparkReady(this.sparkProgress(), this.config));

  // Crew
  readonly nextSlotCost = computed(() => nextSlotCost(this.crewSlots(), this.config));

  /** Refresh "now" so daily displays update at midnight. Call on a timer and on app resume. */
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

  /** Coin price of a pull. The very first single pull is free. */
  cost(count: CrackCount): number {
    if (count === 1 && this.firstPullFree()) return 0;
    return count === 1 ? this.config.economy.crackCost1 : this.config.economy.crackCost10;
  }

  canAfford(count: CrackCount): boolean {
    return this.coins() >= this.cost(count);
  }

  /** Whether a pull of this kind can be made right now. */
  canPull(count: CrackCount, source: PullSource = 'coins'): boolean {
    if (source === 'daily') return count === 1 && this.freePullReady();
    if (source === 'ticket') return count === 10 && this.tenTickets() > 0;
    return this.canAfford(count);
  }

  /** Make a pull. Returns null if it is not allowed right now. */
  crack(count: CrackCount, source: PullSource = 'coins'): LastBatch | null {
    if (!this.canPull(count, source)) return null;
    const s = this.state();
    const cost = source === 'coins' ? this.cost(count) : 0;
    const batch = this.pulls.crack(count, s.collection, s.pity, this.luck());
    const bonus = cost > 0 ? postCrackBonus(count, this.config) : 0;
    const now = this.clock();
    const day = this.dayOf(now);
    const rolled = rollGoals(s.goals, day, localWeekNumber(day), this.config);
    this.commit({
      ...s,
      coins: s.coins - cost + bonus,
      shards: s.shards + batch.shardsGained,
      tenTickets: source === 'ticket' ? s.tenTickets - 1 : s.tenTickets,
      collection: batch.collection,
      pity: batch.pity,
      ...(source === 'daily' ? { freePullAt: now, freePullBoostMs: 0 } : {}),
      goals: recordPulls(rolled, batch.results.map((r) => r.gem.rarity), this.config),
      sparkProgress: s.sparkProgress + count,
      totalCracks: s.totalCracks + count,
    });
    this.nowMs.set(now);
    const before = computeUnlocks(s.totalCracks, bestRarity(s.collection, ROSTER), this.config);
    const after = computeUnlocks(s.totalCracks + count, bestRarity(batch.collection, ROSTER), this.config);
    const unlocked = (Object.keys(after) as (keyof Unlocks)[]).filter((k) => after[k] && !before[k]);
    const result: LastBatch = { count, source, results: batch.results, bonus, bonusBoosted: false, unlocked };
    this.lastBatch.set(result);
    return result;
  }

  /** Watch an ad to multiply the post-pull bonus. Returns the extra coins granted. */
  async boostCrackBonus(): Promise<number> {
    const batch = this.lastBatch();
    if (!batch || batch.bonus <= 0 || batch.bonusBoosted || !(await this.watchAd('postCrack'))) return 0;
    const extra = applyMultiplier(batch.bonus, this.config.economy.adMultiplier) - batch.bonus;
    this.commit({ ...this.state(), coins: this.state().coins + extra });
    this.lastBatch.set({ ...batch, bonusBoosted: true });
    return extra;
  }

  /** Watch a rewarded ad to take time off the free-pull wait. Returns the time taken off (ms). */
  async reduceFreePullWithAd(): Promise<number> {
    if (this.freePullReady() || !(await this.watchAd('freePull'))) return 0;
    return this.applyBoost(this.config.freePull.adReduceMs);
  }

  /** Pay shards to take time off the free-pull wait. Returns the time taken off (ms). */
  reduceFreePullWithShards(): number {
    const s = this.state();
    if (this.freePullReady() || s.shards < this.config.freePull.shardCost) return 0;
    const reduced = this.applyBoost(this.config.freePull.shardReduceMs, s.shards - this.config.freePull.shardCost);
    return reduced;
  }

  /**
   * What the crew's luck and free-pull wait would be if this gem were added or removed.
   * `candidate` previews a gem that is not in the crew (an unowned gem counts as level 1).
   */
  previewCrew(gemId: string | null, candidate: { rarity: Rarity; level: number } | null): CrewPreview {
    const members = this.crewMembers();
    const perm = this.luckParts().sets + this.luckParts().milestones;
    if (gemId && this.crew().includes(gemId)) return previewCrewChange(members, perm, { removeId: gemId }, this.config);
    return previewCrewChange(members, perm, { add: { id: gemId ?? undefined, ...(candidate ?? { rarity: 'quartz' as Rarity, level: 1 }) } }, this.config);
  }

  /** Claim today's login-calendar reward. With an ad, its coins are multiplied. Returns what was granted. */
  async claimStreak(withAd: boolean): Promise<Reward | null> {
    if (!this.dailyNext().canClaim) return null;
    const base = this.config.economy.streakRewards[this.dailyNext().day - 1];
    if (withAd && (!rewardHasCoins(base) || (await this.adMultiplier('daily')) === 0)) return null;
    const now = this.clock();
    const claim = claimDaily(this.state().daily, this.dayOf(now), this.config);
    if (!claim) return null;
    const granted = withAd ? scaleReward(claim.reward, this.config.economy.adMultiplier) : claim.reward;
    this.commit({ ...this.give(this.state(), granted), daily: claim.daily });
    this.nowMs.set(now);
    return granted;
  }

  /** Claim a finished daily or weekly goal. Returns its reward, or null if it can't be claimed. */
  claimGoal(id: string): Reward | null {
    const now = this.clock();
    const day = this.dayOf(now);
    const s = this.state();
    const claim = claimGoal(rollGoals(s.goals, day, localWeekNumber(day), this.config), id, this.config);
    if (!claim) return null;
    this.commit({ ...this.give(s, claim.reward), goals: claim.state });
    return claim.reward;
  }

  /** Claim a reached collection milestone. Luck rewards apply from then on. */
  claimMilestone(count: number): Reward | null {
    const s = this.state();
    const claim = claimMilestone(this.ownedCount(), s.claimedMilestones, count, this.config);
    if (!claim) return null;
    this.commit({ ...this.give(s, claim.reward), claimedMilestones: claim.claimed });
    return claim.reward;
  }

  /** Spend a spark to choose any gem. */
  chooseSparkGem(gemId: string): SparkResult | null {
    const gem = findGem(ROSTER, gemId);
    const s = this.state();
    if (!gem) return null;
    const r = claimSpark(s.collection, s.sparkProgress, gem, this.config);
    if (!r) return null;
    this.commit({ ...s, collection: r.collection, sparkProgress: r.progress, shards: s.shards + r.shardsGained });
    return { gem, outcome: r.outcome, level: r.level, shardsGained: r.shardsGained };
  }

  /** Buy a gem you have not found yet with shards. */
  exchange(gemId: string): boolean {
    const gem = findGem(ROSTER, gemId);
    const s = this.state();
    if (!gem) return false;
    const r = exchangeGem(s.collection, s.shards, gem, this.config);
    if (!r) return false;
    this.commit({ ...s, collection: r.collection, shards: r.shards });
    return true;
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
    this.updateSettings({ adsEnabled: enabled });
  }

  setCloudSave(enabled: boolean): void {
    this.updateSettings({ cloudSave: enabled });
  }

  /** Close the intro and remember that it was seen. */
  completeIntro(): void {
    this.introReplay.set(false);
    if (!this.introSeen()) this.updateSettings({ introSeen: true });
  }

  /** "How to play": show the intro again. */
  replayIntro(): void {
    this.introReplay.set(true);
  }

  private updateSettings(patch: Partial<SaveData['settings']>): void {
    this.commit({ ...this.state(), settings: { ...this.state().settings, ...patch } });
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
      const rewarded = await this.ads.showRewarded(placement);
      if (!rewarded) this.toast.show('No reward: the ad was not ready or was closed early. Try again!', 3500);
      return rewarded;
    } finally {
      this.adBusy.set(false);
    }
  }

  /** Take up to `ms` off the wait. Optionally also set the shard balance in the same save. */
  private applyBoost(ms: number, shards?: number): number {
    const s = this.state();
    const now = this.clock();
    const b = boostFreePull({ lastAt: s.freePullAt, boostMs: s.freePullBoostMs }, now, this.freeCooldownMs(), ms);
    if (!b) return 0;
    this.commit({ ...s, freePullBoostMs: b.state.boostMs, ...(shards === undefined ? {} : { shards }) });
    this.nowMs.set(now);
    return b.reducedMs;
  }

  private give(s: SaveData, r: Reward): SaveData {
    return { ...s, coins: s.coins + (r.coins ?? 0), shards: s.shards + (r.shards ?? 0), tenTickets: s.tenTickets + (r.tenTickets ?? 0) };
  }

  private dayOf(ms: number): number {
    return localDayNumber(ms, new Date(ms).getTimezoneOffset());
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
