import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { GameStateService } from './services/game-state.service';
import { ToastService } from './services/toast.service';
import { AdDialog } from './ui/ad-dialog';
import { Stalactites } from './ui/stalactites';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Stalactites, AdDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly game = inject(GameStateService);
  protected readonly toast = inject(ToastService);

  constructor() {
    this.game.startClock(inject(DestroyRef));
  }
}
