import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { AdMobAdService, AdMobPlugin, ADMOB_EVENTS } from './admob-ad.service';

type Listener = (info?: unknown) => void;

/** A fake AdMob plugin with scriptable behavior. */
class FakePlugin implements AdMobPlugin {
  listeners = new Map<string, Listener[]>();
  initCalls = 0;
  prepareCalls: { adId: string; isTesting?: boolean }[] = [];
  prepareError: Error | null = null;
  prepareDelayMs = 0;
  /** Called when the ad is shown; drives events. */
  onShow: () => Promise<unknown> = () => Promise.resolve({ type: 'coins', amount: 1 });

  async initialize(): Promise<void> { this.initCalls++; }
  async prepareRewardVideoAd(o: { adId: string; isTesting?: boolean }): Promise<unknown> {
    this.prepareCalls.push(o);
    if (this.prepareDelayMs) await new Promise((r) => setTimeout(r, this.prepareDelayMs));
    if (this.prepareError) throw this.prepareError;
    return {};
  }
  showRewardVideoAd(): Promise<unknown> { return this.onShow(); }
  async addListener(event: string, fn: Listener): Promise<{ remove(): Promise<void> }> {
    const list = this.listeners.get(event) ?? [];
    list.push(fn);
    this.listeners.set(event, list);
    return { remove: async () => { this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== fn)); } };
  }
  emit(event: string): void { (this.listeners.get(event) ?? []).forEach((l) => l()); }
  count(event: string): number { return (this.listeners.get(event) ?? []).length; }
}

describe('AdMobAdService', () => {
  let plugin: FakePlugin;
  let svc: AdMobAdService;

  beforeEach(() => {
    plugin = new FakePlugin();
    svc = new AdMobAdService(GAME_CONFIG, plugin);
  });
  afterEach(() => vi.useRealTimers());

  it('uses only Google test ids and requests test ads', async () => {
    expect(GAME_CONFIG.ads.admob.appId.startsWith('ca-app-pub-3940256099942544~')).toBe(true);
    expect(GAME_CONFIG.ads.admob.rewardedUnitId.startsWith('ca-app-pub-3940256099942544/')).toBe(true);
    plugin.onShow = async () => { plugin.emit(ADMOB_EVENTS.rewarded); plugin.emit(ADMOB_EVENTS.dismissed); return {}; };
    await svc.showRewarded('idle');
    expect(plugin.prepareCalls[0]).toEqual({ adId: GAME_CONFIG.ads.admob.rewardedUnitId, isTesting: true });
  });

  it('rewards when the reward callback fires before the ad is dismissed', async () => {
    plugin.onShow = async () => {
      plugin.emit(ADMOB_EVENTS.rewarded);
      plugin.emit(ADMOB_EVENTS.dismissed);
      return new Promise(() => undefined); // real plugin may never resolve on dismiss
    };
    expect(await svc.showRewarded('daily')).toBe(true);
  });

  it('does NOT reward when the player dismisses without earning it', async () => {
    plugin.onShow = () => {
      plugin.emit(ADMOB_EVENTS.dismissed);
      return new Promise(() => undefined);
    };
    expect(await svc.showRewarded('idle')).toBe(false);
  });

  it('does not reward when the ad fails to show', async () => {
    plugin.onShow = () => {
      plugin.emit(ADMOB_EVENTS.failedToShow);
      return new Promise(() => undefined);
    };
    expect(await svc.showRewarded('idle')).toBe(false);
  });

  it('does not reward when show() rejects', async () => {
    plugin.onShow = () => Promise.reject(new Error('boom'));
    expect(await svc.showRewarded('idle')).toBe(false);
  });

  it('does not reward when the ad fails to load, and retries next time', async () => {
    plugin.prepareError = new Error('no fill');
    expect(await svc.showRewarded('idle')).toBe(false);
    plugin.prepareError = null;
    plugin.onShow = async () => { plugin.emit(ADMOB_EVENTS.rewarded); plugin.emit(ADMOB_EVENTS.dismissed); return {}; };
    expect(await svc.showRewarded('idle')).toBe(true);
  });

  it('gives up if the ad takes too long to load', async () => {
    vi.useFakeTimers();
    plugin.prepareDelayMs = GAME_CONFIG.ads.loadTimeoutMs * 2;
    const p = svc.showRewarded('idle');
    await vi.advanceTimersByTimeAsync(GAME_CONFIG.ads.loadTimeoutMs + 100);
    expect(await p).toBe(false);
    await vi.advanceTimersByTimeAsync(GAME_CONFIG.ads.loadTimeoutMs * 2);
  });

  it('removes its listeners after each ad and preloads the next one', async () => {
    plugin.onShow = async () => { plugin.emit(ADMOB_EVENTS.rewarded); plugin.emit(ADMOB_EVENTS.dismissed); return {}; };
    await svc.showRewarded('idle');
    await new Promise((r) => setTimeout(r, 0));
    expect(plugin.count(ADMOB_EVENTS.rewarded)).toBe(0);
    expect(plugin.count(ADMOB_EVENTS.dismissed)).toBe(0);
    expect(plugin.prepareCalls.length).toBe(2); // first load + preload of the next
  });

  it('shows one ad at a time', async () => {
    let release: () => void = () => undefined;
    plugin.onShow = () => new Promise<void>((r) => (release = r));
    const first = svc.showRewarded('idle');
    await new Promise((r) => setTimeout(r, 0));
    expect(await svc.showRewarded('daily')).toBe(false);
    plugin.emit(ADMOB_EVENTS.dismissed);
    expect(await first).toBe(false);
    release();
  });
});
