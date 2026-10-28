import { InjectionToken } from '@angular/core';
import { GAME_CONFIG, GameConfig } from '../core/config';
import { mathRng, Rng } from '../core/rng';

/** Active game config. Stage 5 swaps in Remote Config values here. */
export const CONFIG = new InjectionToken<GameConfig>('GameConfig', {
  providedIn: 'root',
  factory: () => GAME_CONFIG,
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
