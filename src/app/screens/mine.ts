import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RARITIES } from '../core/config';
import { GameStateService, CrackCount } from '../services/game-state.service';
import { GeodeArt } from '../ui/geode-art';
import { luckPct, pct, RARITY_COLOR, RARITY_LABEL } from '../ui/format';

@Component({
  selector: 'app-mine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GeodeArt],
  templateUrl: './mine.html',
  styleUrl: './mine.scss',
})
export class Mine {
  protected readonly game = inject(GameStateService);
  private readonly router = inject(Router);

  protected readonly cfg = this.game.config;
  protected readonly color = RARITY_COLOR;
  protected readonly pct = pct;
  protected readonly luckText = computed(() => luckPct(this.game.luck()));
  protected readonly savings = this.cfg.economy.crackCost1 * 10 - this.cfg.economy.crackCost10;

  protected readonly oddsRows = computed(() =>
    RARITIES.map((r) => ({ rarity: r, label: RARITY_LABEL[r], odds: this.game.odds()[r] })),
  );

  protected readonly pityRows = computed(() => {
    const p = this.game.pity();
    const { emeraldOrBetter, rubyOrBetter } = this.cfg.pity;
    return [
      { label: 'Emerald or better', count: p.sinceEmerald, limit: emeraldOrBetter },
      { label: 'Ruby or better', count: p.sinceRuby, limit: rubyOrBetter },
    ].map((r) => ({ ...r, next: r.count + 1 >= r.limit }));
  });

  protected crack(count: CrackCount): void {
    if (this.game.crack(count)) void this.router.navigate(['/mine/result']);
  }
}
