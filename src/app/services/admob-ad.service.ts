import { GameConfig } from '../core/config';
import { AdPlacement, AdService } from './ad.service';

/** The slice of the @capacitor-community/admob plugin that we use (so tests can fake it). */
export interface AdMobPlugin {
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
 * Real rewarded ads through AdMob, using Google TEST ad unit ids only.
 * A reward is reported only after the plugin's reward callback fires.
 */
export class AdMobAdService extends AdService {
  private ready: Promise<boolean> | null = null;
  private showing = false;

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

  override isAvailable(): boolean {
    return true;
  }

  override async showRewarded(_placement: AdPlacement): Promise<boolean> {
    if (this.showing) return false;
    this.showing = true;
    try {
      if (!(await this.waitForAd())) return false; // a failed load retries on the next request
      this.ready = null; // a loaded ad can be shown once
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
          await this.plugin.initialize({ initializeForTesting: true });
          await this.plugin.prepareRewardVideoAd({ adId: this.config.ads.admob.rewardedUnitId, isTesting: true });
          return true;
        } catch {
          return false;
        }
      })().then((ok) => {
        if (!ok) this.ready = null; // retry on the next request
        return ok;
      });
    }
    return this.ready;
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
