import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { findGem, ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { GemArt } from './gem-art';
import { GoldMachine } from './gold-machine';

/** Short "how to play" shown on first launch (and from Settings). Numbers come from the config. */
@Component({
  selector: 'app-intro-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, GoldMachine],
  templateUrl: './intro-dialog.html',
  styleUrl: './intro-dialog.scss',
})
export class IntroDialog {
  protected readonly game = inject(GameStateService);
  protected readonly cfg = this.game.config;
  protected readonly pebble = findGem(ROSTER, 'pebble')!;
  protected readonly halo = findGem(ROSTER, 'halo')!;
  protected readonly ember = findGem(ROSTER, 'ember')!;
  protected readonly step = signal(0);
  protected readonly steps = 3;
  protected readonly last = computed(() => this.step() === this.steps - 1);

  protected next(): void {
    if (this.last()) this.finish();
    else this.step.update((s) => s + 1);
  }

  protected back(): void {
    this.step.update((s) => Math.max(s - 1, 0));
  }

  protected finish(): void {
    this.game.completeIntro();
    this.step.set(0);
  }
}
