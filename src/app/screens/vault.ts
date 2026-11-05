import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RARITIES, Rarity } from '../core/config';
import { findGem, ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { describeReward, luckPct, RARITY_COLOR, RARITY_LABEL } from '../ui/format';
import { GemArt } from '../ui/gem-art';
import { GemSheet } from '../ui/gem-sheet';

@Component({
  selector: 'app-vault',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, GemSheet, RouterLink],
  templateUrl: './vault.html',
  styleUrl: './vault.scss',
})
export class Vault {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);
  protected readonly describe = describeReward;
  protected readonly luckPct = luckPct;
  protected readonly color = RARITY_COLOR;
  protected readonly selected = signal<string | null>(null);
  protected readonly selectedGem = computed(() => {
    const id = this.selected();
    return id ? findGem(ROSTER, id) : undefined;
  });
  protected readonly selectedLevel = computed(() => this.game.collection()[this.selected() ?? '']?.level ?? 1);
  protected readonly crewFull = computed(() => this.game.crew().length >= this.game.crewSlots());
  /** Progress bar fill: owned gems over the last milestone. */
  protected readonly lastMilestone = this.game.config.progression.milestones.at(-1)?.count ?? ROSTER.length;
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

  protected claim(count: number): void {
    const reward = this.game.claimMilestone(count);
    if (reward) this.toast.show(`Collection reward: ${describeReward(reward)}`);
  }

  protected toggleCrew(): void {
    const id = this.selected();
    if (!id) return;
    if (this.game.crew().includes(id)) this.game.removeFromCrew(id);
    else if (!this.game.addToCrew(id)) this.toast.show('Crew is full. Remove a gem first.');
  }
}
