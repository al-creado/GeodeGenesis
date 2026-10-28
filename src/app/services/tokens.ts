import { inject, InjectionToken } from '@angular/core';
import { GameConfig } from '../core/config';
import { mathRng, Rng } from '../core/rng';
import { RemoteConfigService } from './remote-config.service';

/** Active game config: defaults plus validated Remote Config overrides. */
export const CONFIG = new InjectionToken<GameConfig>('GameConfig', {
  providedIn: 'root',
  factory: () => inject(RemoteConfigService).config,
});

/** Current time in epoch milliseconds (injectable for tests). */
export const CLOCK = new InjectionToken<() => number>('Clock', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

/** Random source for pulls (injectable for deterministic tests). */
export const RNG = new InjectionToken<Rng>('Rng', {
  providedIn: 'root',
  factory: () => mathRng,
});
