import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Rarity } from '../core/config';
import { isAtLeast } from '../core/odds';
import { CrackResult } from '../core/pull';
import { CrackCount, GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { AdNote } from '../ui/ad-note';
import { luckPct, RARITY_LABEL } from '../ui/format';
import { GemArt } from '../ui/gem-art';
import { GeodeArt } from '../ui/geode-art';
import { ART } from '../core/gem-art';

const REVEAL_MS = 1300;
const GLOW: Record<Rarity, string> = {
  quartz: ART.frame.quartz,
  amethyst: ART.palette.amethyst,
  emerald: ART.palette.emerald,
  ruby: ART.palette.ruby,
  diamond: '#FFFFFF',
};

@Component({
  selector: 'app-mine-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GemArt, GeodeArt, AdNote, RouterLink],
  templateUrl: './mine-result.html',
  styleUrl: './mine-result.scss',
})
export class MineResult implements OnInit {
  protected readonly game = inject(GameStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cfg = this.game.config;
  protected readonly label = RARITY_LABEL;
  protected readonly luckPct = luckPct;
  protected readonly revealed = signal(false);
  protected readonly batch = this.game.lastBatch;

  /** Best rarity in the batch decides the glow color. */
  protected readonly best = computed<Rarity>(() => {
    const results = this.batch()?.results ?? [];
    return results.reduce<Rarity>((acc, r) => (isAtLeast(r.gem.rarity, acc) ? r.gem.rarity : acc), 'quartz');
  });
  protected readonly glow = computed(() => GLOW[this.best()]);
  protected readonly single = computed<CrackResult | null>(() => (this.batch()?.count === 1 ? (this.batch()?.results[0] ?? null) : null));
  protected readonly newCount = computed(() => (this.batch()?.results ?? []).filter((r) => r.outcome === 'new').length);
  protected readonly shardTotal = computed(() => (this.batch()?.results ?? []).reduce((a, r) => a + r.shardsGained, 0));
  protected readonly pityHit = computed(() => (this.batch()?.results ?? []).some((r) => r.pityTrigger !== null));
  protected readonly extraBonus = computed(() => {
    const b = this.batch();
    return b ? b.bonus * (this.cfg.economy.adMultiplier - 1) : 0;
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (!this.batch()) {
      void this.router.navigate(['/mine'], { replaceUrl: true });
      return;
    }
    this.startReveal();
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  protected skip(): void {
    this.clearTimer();
    this.revealed.set(true);
  }

  protected again(): void {
    const b = this.batch();
    if (!b || !this.game.crack(b.count)) return;
    this.startReveal();
  }

  protected canAgain(): boolean {
    const b = this.batch();
    return !!b && this.game.canAfford(b.count);
  }

  protected againCost(): number {
    return this.game.cost((this.batch()?.count ?? 1) as CrackCount);
  }

  protected async boost(): Promise<void> {
    const extra = await this.game.boostCrackBonus();
    if (extra > 0) this.toast.show(`+${extra} bonus coins`);
  }

  private startReveal(): void {
    this.clearTimer();
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.revealed.set(true);
      return;
    }
    this.revealed.set(false);
    this.timer = setTimeout(() => this.revealed.set(true), REVEAL_MS);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
