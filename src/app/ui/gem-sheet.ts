import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { effectiveCooldownMs } from '../core/timer';
import { gemPassives } from '../core/passives';
import { GemDef } from '../core/roster';
import { exchangeCost } from '../core/shop';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { formatDuration, luckPct, RARITY_LABEL, timerPct } from './format';
import { GemArt } from './gem-art';

/**
 * A gem's preview card: exact rewards, passive effects while in the crew, and the crew's totals
 * before and after. Every number is exact (nothing about a gem is rolled), so there are no ranges.
 * For a gem the player has not found yet, name and art stay hidden but its stats are shown.
 */
@Component({
  selector: 'app-gem-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt],
  templateUrl: './gem-sheet.html',
  styleUrl: './gem-sheet.scss',
})
export class GemSheet {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);
  protected readonly cfg = this.game.config;

  readonly gem = input.required<GemDef>();
  readonly close = output<void>();

  protected readonly label = RARITY_LABEL;
  protected readonly luckPct = luckPct;
  protected readonly timerPct = timerPct;
  protected readonly formatDuration = formatDuration;
  protected readonly maxLevel = this.cfg.duplicates.maxLevel;
  protected readonly pips = Array.from({ length: this.maxLevel }, (_, i) => i + 1);

  protected readonly owned = computed(() => !!this.game.collection()[this.gem().id]);
  protected readonly level = computed(() => this.game.collection()[this.gem().id]?.level ?? 1);
  protected readonly isMax = computed(() => this.level() >= this.maxLevel);
  protected readonly inCrew = computed(() => this.game.crew().includes(this.gem().id));
  protected readonly crewFull = computed(() => this.game.crew().length >= this.game.crewSlots());

  /** Passives at the gem's current level (level 1 if not found yet), and at max level. */
  protected readonly now = computed(() => gemPassives(this.gem().rarity, this.level(), this.cfg));
  protected readonly atMax = computed(() => gemPassives(this.gem().rarity, this.maxLevel, this.cfg));
  protected readonly hasTimerPassive = computed(() => this.now().timerReduction > 0);

  /** What happens to the crew's totals if this gem is added (or removed, when it is in the crew). */
  protected readonly preview = computed(() => this.game.previewCrew(this.gem().id, { rarity: this.gem().rarity, level: this.level() }));
  protected readonly waitBefore = computed(() => effectiveCooldownMs(this.preview().before.timerReduction, this.cfg));
  protected readonly waitAfter = computed(() => effectiveCooldownMs(this.preview().after.timerReduction, this.cfg));
  protected readonly changes = computed(() => this.preview().before.luck !== this.preview().after.luck || this.waitBefore() !== this.waitAfter());

  protected readonly shardsOnDupe = computed(() => this.cfg.duplicates.shardsPerDuplicate[this.gem().rarity]);
  protected readonly price = computed(() => exchangeCost(this.gem(), this.cfg));
  protected readonly canToggle = computed(() => this.owned() && this.game.unlocks().crew);

  protected toggle(): void {
    const id = this.gem().id;
    if (this.inCrew()) this.game.removeFromCrew(id);
    else if (!this.game.addToCrew(id)) this.toast.show('Crew is full. Remove a gem first.');
  }
}
