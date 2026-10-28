import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RARITIES, Rarity } from '../core/config';
import { ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { RARITY_LABEL } from '../ui/format';
import { GemArt } from '../ui/gem-art';

@Component({
  selector: 'app-vault',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt],
  templateUrl: './vault.html',
  styleUrl: './vault.scss',
})
export class Vault {
  protected readonly game = inject(GameStateService);
  protected readonly maxLevel = this.game.config.duplicates.maxLevel;
  protected readonly filters: readonly ('all' | Rarity)[] = ['all', ...RARITIES];
  protected readonly label = (f: 'all' | Rarity): string => (f === 'all' ? 'All' : RARITY_LABEL[f]);
  protected readonly filter = signal<'all' | Rarity>('all');

  protected readonly cells = computed(() => {
    const owned = this.game.collection();
    const f = this.filter();
    return ROSTER.filter((g) => f === 'all' || g.rarity === f).map((gem) => ({ gem, level: owned[gem.id]?.level ?? 0 }));
  });
  protected readonly foundInFilter = computed(() => this.cells().filter((c) => c.level > 0).length);
}
