import { Injectable, Signal, signal } from '@angular/core';

/** Where a rewarded ad was offered. */
export type AdPlacement = 'daily' | 'postCrack' | 'freePull';

/**
 * Rewarded ads. Ads multiply coin rewards and shorten the free-pull wait; they never touch pull odds.
 * showRewarded resolves true ONLY after the reward callback fires.
 *
 * The UI shows ad buttons only while `available()` is true, so a build or device with no ads
 * (the browser, no connection, no fill) simply has no ad UI.
 */
@Injectable({ providedIn: 'root', useFactory: () => new NoAdsService() })
export abstract class AdService {
  /** True when this platform can show ads at all (false in the browser). Used for the ad settings. */
  abstract readonly supported: boolean;
  /** True while a rewarded ad is loaded and ready. Ad buttons are hidden when false. */
  abstract readonly available: Signal<boolean>;
  abstract showRewarded(placement: AdPlacement): Promise<boolean>;

  /** True when ad-privacy choices must be offered (EEA/UK consent). Only AdMob ever sets this. */
  readonly privacyOptionsRequired = signal(false);

  /** Re-open the ad-privacy choices form. No-op for providers without one. */
  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }
}

/** Used wherever AdMob is not available (the browser, or a build without the plugin). Never offers ads. */
export class NoAdsService extends AdService {
  override readonly supported = false;
  override readonly available = signal(false).asReadonly();
  override showRewarded(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
