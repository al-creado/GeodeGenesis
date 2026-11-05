import { inject, Injectable } from '@angular/core';
import { BatchResult, Collection, crack, PityState } from '../core/pull';
import { ROSTER } from '../core/roster';
import { CONFIG, RNG } from './tokens';

/** Runs geode cracks with the app's config, roster and RNG. */
@Injectable({ providedIn: 'root' })
export class PullService {
  private readonly config = inject(CONFIG);
  private readonly rng = inject(RNG);

  crack(count: number, collection: Collection, pity: PityState, luck: number): BatchResult {
    return crack(count, { collection, pity }, luck, this.rng, ROSTER, this.config);
  }
}
