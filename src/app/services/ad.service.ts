import { inject, Injectable, signal } from '@angular/core';
import { GameConfig } from '../core/config';
import { CONFIG } from './tokens';

export type AdPlacement = 'idle' | 'daily' | 'postCrack';

/**
 * Rewarded ads. Ads multiply coin rewards only and never touch pull odds.
 * showRewarded resolves true ONLY after the reward callback fires.
 */
@Injectable({ providedIn: 'root', useFactory: () => new SimulatedAdService(inject(CONFIG)) })
export abstract class AdService {
  abstract isAvailable(): boolean;
  abstract showRewarded(placement: AdPlacement): Promise<boolean>;

  /** True when ad-privacy choices must be offered (EEA/UK consent). Only AdMob ever sets this. */
  readonly privacyOptionsRequired = signal(false);

  /** Re-open the ad-privacy choices form. No-op for providers without one. */
  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }
}

export interface SimulatedAdDialog {
  readonly placement: AdPlacement;
  readonly remainingMs: number;
  readonly totalMs: number;
}

const TICK_MS = 100;

/** Browser stand-in: a fake ad dialog that "plays" for a few seconds. */
export class SimulatedAdService extends AdService {
  /** Drives the dialog UI; null when no ad is showing. */
  readonly dialog = signal<SimulatedAdDialog | null>(null);
  private finish: ((rewarded: boolean) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: GameConfig) {
    super();
  }

  override isAvailable(): boolean {
    return true;
  }

  override showRewarded(placement: AdPlacement): Promise<boolean> {
    if (this.finish) return Promise.resolve(false); // one ad at a time
    const totalMs = this.config.ads.simulatedDurationMs;
    this.dialog.set({ placement, remainingMs: totalMs, totalMs });
    return new Promise<boolean>((resolve) => {
      this.finish = resolve;
      this.timer = setInterval(() => {
        const d = this.dialog();
        if (!d) return;
        const remainingMs = Math.max(d.remainingMs - TICK_MS, 0);
        if (remainingMs === 0) this.close(true); // reward callback
        else this.dialog.set({ ...d, remainingMs });
      }, TICK_MS);
    });
  }

  /** The player closes the ad early: no reward. */
  cancel(): void {
    this.close(false);
  }

  private close(rewarded: boolean): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const finish = this.finish;
    this.finish = null;
    this.dialog.set(null);
    finish?.(rewarded);
  }
}

/** Fallback when ads are unavailable or turned off. Never grants rewards. */
export class NoAdsService extends AdService {
  override isAvailable(): boolean {
    return false;
  }
  override showRewarded(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
