import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { GameStateService } from './services/game-state.service';
import { ToastService } from './services/toast.service';
import { RARITY_LABEL } from './ui/format';
import { AdDialog } from './ui/ad-dialog';
import { IntroDialog } from './ui/intro-dialog';
import { Stalactites } from './ui/stalactites';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Stalactites, AdDialog, IntroDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly game = inject(GameStateService);
  protected readonly toast = inject(ToastService);

  /** Why each locked tab is locked, in the player's words. */
  protected readonly hint = {
    daily: 'Unlocks after your first pull.',
    vault: 'Unlocks after your first pull.',
    crew: `Unlocks when you find your first ${RARITY_LABEL[this.game.config.unlocks.crewAfterRarity]}.`,
  };

  protected locked(message: string): void {
    this.toast.show(message, 3000);
  }

  constructor() {
    this.game.startClock(inject(DestroyRef));
  }
}
