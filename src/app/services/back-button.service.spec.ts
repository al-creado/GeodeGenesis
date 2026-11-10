import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveData } from '../core/save';
import { APP_EXIT, BackButtonService } from './back-button.service';
import { GameStateService } from './game-state.service';
import { SaveService } from './save.service';

class MemorySave extends SaveService {
  override load(): unknown { return null; }
  override save(_: SaveData): void {}
  override clear(): void {}
}

describe('BackButtonService', () => {
  let url: string;
  const navigate = vi.fn();
  const back = vi.fn();
  const exit = vi.fn();

  function setup(): { svc: BackButtonService; game: GameStateService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SaveService, useValue: new MemorySave() },
        { provide: Router, useValue: { get url() { return url; }, navigate } },
        { provide: Location, useValue: { back } },
        { provide: APP_EXIT, useValue: exit },
      ],
    });
    const game = TestBed.inject(GameStateService);
    game.completeIntro(); // start without the intro open
    return { svc: TestBed.inject(BackButtonService), game };
  }

  beforeEach(() => {
    navigate.mockClear(); back.mockClear(); exit.mockClear();
  });

  it('closes the intro first', () => {
    url = '/pulls';
    const { svc, game } = setup();
    game.replayIntro();
    svc.handle();
    expect(game.showIntro()).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it('goes from the result screen to Pulls', () => {
    url = '/pulls/result';
    setup().svc.handle();
    expect(navigate).toHaveBeenCalledWith(['/pulls']);
  });

  it('goes from a tab to Pulls, then exits from Pulls', () => {
    url = '/vault';
    setup().svc.handle();
    expect(navigate).toHaveBeenCalledWith(['/pulls']);
    url = '/pulls';
    setup().svc.handle();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('uses history for Settings', () => {
    url = '/settings';
    setup().svc.handle();
    expect(back).toHaveBeenCalled();
  });
});
