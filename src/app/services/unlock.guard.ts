import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Unlocks } from '../core/unlocks';
import { GameStateService } from './game-state.service';

/** Keeps players out of screens they have not unlocked yet (sends them to Pulls). */
export function requireUnlock(key: keyof Unlocks): CanActivateFn {
  return () => (inject(GameStateService).unlocks()[key] ? true : inject(Router).createUrlTree(['/pulls']));
}
