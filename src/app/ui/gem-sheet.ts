import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { gemLuck } from '../core/progression';
import { GemDef } from '../core/roster';
import { CONFIG } from '../services/tokens';
import { GemArt } from './gem-art';
import { luckPct, RARITY_LABEL } from './format';

/** A gem's profile: its story, level, and what its level does for the crew. */
@Component({
  selector: 'app-gem-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt],
  templateUrl: './gem-sheet.html',
  styleUrl: './gem-sheet.scss',
})
export class GemSheet {
  private readonly cfg = inject(CONFIG);

  readonly gem = input.required<GemDef>();
  readonly level = input.required<number>();
  readonly inCrew = input(false);
  /** Crew is unlocked, so the crew button makes sense. */
  readonly crewUnlocked = input(false);
  readonly crewFull = input(false);
  readonly close = output<void>();
  readonly toggleCrew = output<void>();

  protected readonly label = RARITY_LABEL;
  protected readonly luckPct = luckPct;
  protected readonly maxLevel = this.cfg.duplicates.maxLevel;
  protected readonly pips = Array.from({ length: this.maxLevel }, (_, i) => i + 1);
  protected readonly now = computed(() => gemLuck(this.gem().rarity, this.level(), this.cfg));
  protected readonly atMax = computed(() => gemLuck(this.gem().rarity, this.maxLevel, this.cfg));
  protected readonly next = computed(() => gemLuck(this.gem().rarity, Math.min(this.level() + 1, this.maxLevel), this.cfg));
  protected readonly isMax = computed(() => this.level() >= this.maxLevel);
  protected readonly shardsOnDupe = computed(() => this.cfg.duplicates.shardsPerDuplicate[this.gem().rarity]);
  protected readonly perLevel = computed(() => this.cfg.luckPerGem[this.gem().rarity] * this.cfg.progression.levelLuckFactor);
}
