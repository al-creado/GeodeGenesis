import { Location } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { decideBack } from '../core/navigation';
import { GameStateService } from './game-state.service';

/** Leaves the app (Android back button on the Camp tab). Replaceable in tests. */
export const APP_EXIT = new InjectionToken<() => void>('AppExit', {
  providedIn: 'root',
  factory: () => () => void App.exitApp(),
});

/** Wires the Android hardware back button to the app's navigation. */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly game = inject(GameStateService);
  private readonly exit = inject(APP_EXIT);

  /** Start listening. Does nothing outside the native app. */
  start(): void {
    if (!Capacitor.isNativePlatform()) return;
    void App.addListener('backButton', () => this.handle());
  }

  handle(): void {
    const action = decideBack(this.router.url, this.game.showIntro());
    switch (action.type) {
      case 'closeOverlay':
        this.game.completeIntro();
        break;
      case 'navigate':
        void this.router.navigate([action.to]);
        break;
      case 'history':
        this.location.back();
        break;
      case 'exit':
        this.exit();
        break;
    }
  }
}
