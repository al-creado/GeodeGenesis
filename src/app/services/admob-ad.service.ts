import { signal } from '@angular/core';
import { GameConfig } from '../core/config';
import { AdPlacement, AdService } from './ad.service';

/** The slice of the @capacitor-community/admob plugin that we use (so tests can fake it). */
export interface ConsentInfoLike {
  status: string;
  isConsentFormAvailable?: boolean;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: string;
}

export interface AdMobPlugin {
  requestConsentInfo(options?: { tagForUnderAgeOfConsent?: boolean }): Promise<ConsentInfoLike>;
  showConsentForm(): Promise<ConsentInfoLike>;
  showPrivacyOptionsForm(): Promise<void>;
  initialize(options?: { initializeForTesting?: boolean }): Promise<void>;
  prepareRewardVideoAd(options: { adId: string; isTesting?: boolean }): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
  addListener(event: string, listener: (info?: unknown) => void): Promise<{ remove(): Promise<void> }>;
}

/** Event names of the plugin's RewardAdPluginEvents enum. */
export const ADMOB_EVENTS = {
  rewarded: 'onRewardedVideoAdReward',
  dismissed: 'onRewardedVideoAdDismissed',
  failedToShow: 'onRewardedVideoAdFailedToShow',
} as const;

/**
 * Rewarded ads through AdMob. Ships with Google TEST ad unit ids (see GAME_CONFIG.ads.admob).
 * A reward is reported only after the plugin's reward callback fires.
 */
export class AdMobAdService extends AdService {
  override readonly supported = true;
  private readonly loaded = signal(false);
  /** True while an ad is loaded and can be shown. */
  override readonly available = this.loaded.asReadonly();
  private ready: Promise<boolean> | null = null;
  private showing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: GameConfig,
    private readonly plugin: AdMobPlugin,
  ) {
    super();
  }

  /** Initialize the SDK and start loading the first ad. Safe to call more than once. */
  start(): void {
    void this.preload();
  }

  override async showRewarded(_placement: AdPlacement): Promise<boolean> {
    if (this.showing) return false;
    this.showing = true;
    try {
      if (!(await this.waitForAd())) return false; // a failed load retries on the next request
      this.ready = null; // a loaded ad can be shown once
      this.loaded.set(false);
      const rewarded = await this.play();
      this.start(); // load the next one in the background
      return rewarded;
    } finally {
      this.showing = false;
    }
  }

  private preload(): Promise<boolean> {
    if (!this.ready) {
      this.ready = (async () => {
        try {
          await this.ensureConsent();
          const { rewardedUnitId, useTestAds } = this.config.ads.admob;
          await this.plugin.initialize({ initializeForTesting: useTestAds });
          await this.plugin.prepareRewardVideoAd({ adId: rewardedUnitId, isTesting: useTestAds });
          return true;
        } catch {
          return false;
        }
      })().then((ok) => {
        this.loaded.set(ok);
        if (!ok) {
          this.ready = null; // retry on the next request
          this.scheduleRetry();
        }
        return ok;
      });
    }
    return this.ready;
  }

  override async showPrivacyOptions(): Promise<void> {
    await this.plugin.showPrivacyOptionsForm();
  }

  /** Google UMP consent: ask in regions that require it, and don't request ads without it. */
  private async ensureConsent(): Promise<void> {
    // The game is for players 13 and over, so no under-age tagging.
    let info = await this.plugin.requestConsentInfo({ tagForUnderAgeOfConsent: false });
    if (info.status === 'REQUIRED' && info.isConsentFormAvailable) {
      info = await this.plugin.showConsentForm();
    }
    this.privacyOptionsRequired.set(info.privacyOptionsRequirementStatus === 'REQUIRED');
    if (!info.canRequestAds) throw new Error('Ad consent was not given');
  }

  /** After a failed load, try again later so the ad buttons appear once an ad is available. */
  private scheduleRetry(): void {
    if (this.retryTimer || this.config.ads.retryMs <= 0) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.showing) this.start();
    }, this.config.ads.retryMs);
  }

  private async waitForAd(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), this.config.ads.loadTimeoutMs);
    });
    try {
      return await Promise.race([this.preload(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private play(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let done = false;
      const handles: Promise<{ remove(): Promise<void> }>[] = [];

      const finish = (result: boolean): void => {
        if (done) return;
        done = true;
        for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
        resolve(result);
      };

      handles.push(this.plugin.addListener(ADMOB_EVENTS.rewarded, () => (rewarded = true)));
      handles.push(this.plugin.addListener(ADMOB_EVENTS.dismissed, () => finish(rewarded)));
      handles.push(this.plugin.addListener(ADMOB_EVENTS.failedToShow, () => finish(false)));

      this.plugin.showRewardVideoAd().then(
        () => (rewarded = true), // resolves when the user earns the reward
        () => finish(false),
      );
    });
  }
}
