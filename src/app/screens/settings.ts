import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RARITIES } from '../core/config';
import { CloudSyncService } from '../services/cloud-sync.service';
import { GameStateService } from '../services/game-state.service';
import { luckPct, pct, RARITY_COLOR, RARITY_LABEL } from '../ui/format';

/** Settings plus the full rates and pity rules (required by Google Play). */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly game = inject(GameStateService);
  protected readonly cloud = inject(CloudSyncService);
  private readonly location = inject(Location);

  protected readonly cfg = this.game.config;
  protected readonly color = RARITY_COLOR;
  protected readonly label = RARITY_LABEL;
  protected readonly luckPct = luckPct;
  protected readonly pct = pct;
  protected readonly capText = luckPct(this.cfg.crew.luckCap);
  protected readonly confirmReset = signal(false);

  protected readonly rows = computed(() =>
    RARITIES.map((r) => ({
      rarity: r,
      base: this.game.baseOdds[r],
      current: this.game.odds()[r],
      luck: this.cfg.luckPerGem[r],
      shards: this.cfg.duplicates.shardsPerDuplicate[r],
    })),
  );

  protected readonly syncedText = computed(() => {
    const at = this.cloud.lastSyncedAt();
    return at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  });

  protected syncNow(): void {
    void this.cloud.start();
  }

  protected back(): void {
    this.location.back();
  }

  protected setAds(event: Event): void {
    this.game.setAdsEnabled((event.target as HTMLInputElement).checked);
  }

  protected reset(): void {
    if (!this.confirmReset()) {
      this.confirmReset.set(true);
      return;
    }
    this.game.resetProgress();
    this.confirmReset.set(false);
  }
}
