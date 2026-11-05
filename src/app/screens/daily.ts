import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { rewardHasCoins, scaleReward } from '../core/economy';
import { GameStateService } from '../services/game-state.service';
import { ToastService } from '../services/toast.service';
import { AdNote } from '../ui/ad-note';
import { describeReward, shortReward } from '../ui/format';

/** Daily rhythm: a free pull, the login calendar, and goals. */
@Component({
  selector: 'app-daily',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdNote],
  templateUrl: './daily.html',
  styleUrl: './daily.scss',
})
export class Daily {
  protected readonly game = inject(GameStateService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly cfg = this.game.config;
  protected readonly describe = describeReward;
  protected readonly short = shortReward;

  protected readonly nextReward = computed(() => this.cfg.economy.streakRewards[this.game.dailyNext().day - 1]);
  protected readonly canDouble = computed(() => rewardHasCoins(this.nextReward()));
  protected readonly doubled = computed(() => scaleReward(this.nextReward(), this.cfg.economy.adMultiplier));

  protected freePull(): void {
    if (this.game.crack(1, 'daily')) void this.router.navigate(['/mine/result']);
  }

  protected async claim(withAd: boolean): Promise<void> {
    const granted = await this.game.claimStreak(withAd);
    if (granted) this.toast.show(`Daily reward: ${describeReward(granted)}`);
  }

  protected claimGoal(id: string): void {
    const reward = this.game.claimGoal(id);
    if (reward) this.toast.show(`Goal reward: ${describeReward(reward)}`);
  }
}
