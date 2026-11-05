import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { findGem, ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { AdNote } from '../ui/ad-note';
import { formatDuration } from '../ui/format';
import { GemArt } from '../ui/gem-art';

@Component({
  selector: 'app-camp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, AdNote],
  templateUrl: './camp.html',
  styleUrl: './camp.scss',
})
export class Camp {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);

  protected readonly cfg = this.game.config.economy;
  protected readonly mascot = findGem(ROSTER, 'pebble')!;
  protected readonly full = computed(() => this.game.idleFill() >= 1);
  protected readonly fillPct = computed(() => Math.round(this.game.idleFill() * 100));
  protected readonly fullIn = computed(() => formatDuration(this.game.idleMsLeft()));
  protected readonly dailyNextCoins = computed(() => this.cfg.dailyBonus[this.game.dailyNext().day - 1]);

  protected async collect(withAd: boolean): Promise<void> {
    const gained = await this.game.collectIdle(withAd);
    if (gained > 0) this.toast.show(`+${gained} coins`);
  }

  protected async claim(withAd: boolean): Promise<void> {
    const gained = await this.game.claimDaily(withAd);
    if (gained > 0) this.toast.show(`Daily bonus +${gained} coins`);
  }
}
