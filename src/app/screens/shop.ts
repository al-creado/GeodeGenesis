import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rarityRank } from '../core/odds';
import { exchangeCost } from '../core/shop';
import { GemDef, ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { RARITY_LABEL } from '../ui/format';
import { GemArt } from '../ui/gem-art';

/** Spark (pick any gem at a pull count) and shard exchange for gems you have not found. */
@Component({
  selector: 'app-shop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, RouterLink],
  templateUrl: './shop.html',
  styleUrl: './shop.scss',
})
export class Shop {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);

  protected readonly cfg = this.game.config;
  protected readonly label = RARITY_LABEL;
  protected readonly picking = signal(false);
  protected readonly circumference = 2 * Math.PI * 50;

  protected readonly sparkFraction = computed(() => Math.min(this.game.sparkProgress() / this.cfg.shop.sparkAt, 1));

  /** Gems not found yet, rarest first, with their shard price. */
  protected readonly missing = computed(() => {
    const c = this.game.collection();
    return ROSTER.filter((g) => !c[g.id])
      .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name))
      .map((gem) => ({ gem, cost: exchangeCost(gem, this.cfg) }));
  });

  /** Every gem, rarest first, for the spark picker. */
  protected readonly everyGem = computed(() => {
    const c = this.game.collection();
    return [...ROSTER]
      .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name))
      .map((gem) => ({ gem, owned: !!c[gem.id] }));
  });

  protected choose(gem: GemDef): void {
    const r = this.game.chooseSparkGem(gem.id);
    this.picking.set(false);
    if (!r) return;
    this.toast.show(
      r.outcome === 'new' ? `${gem.name} joined your Vault!` : r.outcome === 'levelUp' ? `${gem.name} is now level ${r.level}!` : `${gem.name} is max level: +${r.shardsGained} shards`,
      3000,
    );
  }

  protected buy(gem: GemDef): void {
    if (this.game.exchange(gem.id)) this.toast.show(`${gem.name} joined your Vault!`, 3000);
  }
}
