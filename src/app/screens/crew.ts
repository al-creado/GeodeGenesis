import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rarityRank } from '../core/odds';
import { gemPassives } from '../core/passives';
import { gemLuck } from '../core/progression';
import { findGem, GemDef, ROSTER } from '../core/roster';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { formatDuration, luckPct, pct, RARITY_LABEL, timerPct } from '../ui/format';
import { GemArt } from '../ui/gem-art';
import { GemSheet } from '../ui/gem-sheet';

type Slot =
  | { kind: 'gem'; gem: GemDef; luck: number }
  | { kind: 'empty' }
  | { kind: 'locked'; cost: number; next: boolean };

@Component({
  selector: 'app-crew',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, GemSheet],
  templateUrl: './crew.html',
  styleUrl: './crew.scss',
})
export class Crew {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);

  protected readonly cfg = this.game.config;
  protected readonly label = RARITY_LABEL;
  protected readonly luckPct = luckPct;
  protected readonly pct = pct;
  protected readonly timerPct = timerPct;
  protected readonly formatDuration = formatDuration;
  protected readonly baseWait = this.cfg.freePull.cooldownMs;
  protected readonly capText = luckPct(this.cfg.crew.luckCap);

  protected readonly slots = computed<Slot[]>(() => {
    const crew = this.game.crew();
    const unlocked = this.game.crewSlots();
    const out: Slot[] = [];
    for (let i = 0; i < this.cfg.crew.maxSlots; i++) {
      if (i < unlocked) {
        const gem = crew[i] ? findGem(ROSTER, crew[i]) : undefined;
        out.push(gem ? { kind: 'gem', gem, luck: gemLuck(gem.rarity, this.game.collection()[gem.id]?.level ?? 1, this.cfg) } : { kind: 'empty' });
      } else {
        out.push({ kind: 'locked', cost: this.cfg.crew.slotUnlockShards[i - this.cfg.crew.startSlots], next: i === unlocked });
      }
    }
    return out;
  });

  protected readonly parts = this.game.luckParts;
  /** The gem whose preview card is open. */
  protected readonly sheetGem = signal<GemDef | null>(null);
  /** The "add a gem" picker at the top of the page. */
  protected readonly picking = signal(false);
  protected readonly luckFill = computed(() => Math.min(this.game.luck() / this.cfg.crew.luckCap, 1) * 100);
  protected readonly atCap = computed(() => this.game.luck() >= this.cfg.crew.luckCap);
  protected readonly rubyBefore = this.game.baseOdds.ruby;
  protected readonly rubyAfter = computed(() => this.game.odds().ruby);
  protected readonly crewFull = computed(() => this.game.crew().length >= this.game.crewSlots());
  protected readonly canUnlock = computed(() => {
    const cost = this.game.nextSlotCost();
    return cost !== null && this.game.shards() >= cost;
  });

  /** Owned gems, rarest first. */
  protected readonly owned = computed(() => {
    const c = this.game.collection();
    const crew = this.game.crew();
    return ROSTER.filter((g) => c[g.id])
      .map((gem) => ({ gem, level: c[gem.id].level, inCrew: crew.includes(gem.id), luck: gemLuck(gem.rarity, c[gem.id].level, this.cfg), cut: gemPassives(gem.rarity, c[gem.id].level, this.cfg).timerReduction }))
      .sort((a, b) => rarityRank(b.gem.rarity) - rarityRank(a.gem.rarity) || a.gem.name.localeCompare(b.gem.name));
  });

  /** Owned gems not in the crew yet, for the picker. */
  protected readonly candidates = computed(() => this.owned().filter((o) => !o.inCrew));

  protected pick(id: string): void {
    if (this.game.addToCrew(id)) this.picking.set(false);
    else this.toast.show('Crew is full. Remove a gem first.');
  }

  protected toggle(id: string, inCrew: boolean): void {
    if (inCrew) this.game.removeFromCrew(id);
    else if (!this.game.addToCrew(id)) this.toast.show('Crew is full. Remove a gem first.');
  }

  protected unlock(): void {
    if (this.game.unlockCrewSlot()) this.toast.show('Slot unlocked!');
  }
}
