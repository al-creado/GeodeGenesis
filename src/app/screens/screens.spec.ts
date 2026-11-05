import { Component, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { SaveData } from '../core/save';
import { GameStateService } from '../services/game-state.service';
import { SaveService } from '../services/save.service';
import { Camp } from './camp';
import { Crew } from './crew';
import { Mine } from './mine';
import { MineResult } from './mine-result';
import { Settings } from './settings';
import { Vault } from './vault';
import { IntroDialog } from '../ui/intro-dialog';

class MemorySave extends SaveService {
  override load(): unknown { return null; }
  override save(_: SaveData): void {}
  override clear(): void {}
}

@Component({ template: '' })
class Blank {}

function configure(component: Type<unknown>): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([{ path: '**', component: Blank }]), { provide: SaveService, useValue: new MemorySave() }],
  });
}

function render(component: Type<unknown>): HTMLElement {
  configure(component);
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('screens', () => {
  afterEach(() => localStorage.clear());

  it('Camp shows the ad disclosure and daily bonus', () => {
    const el = render(Camp);
    expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
    expect(el.querySelectorAll('.day')).toHaveLength(GAME_CONFIG.economy.dailyBonus.length);
  });

  it('Mine shows the gold machine, whose lever pulls once', () => {
    const el = render(Mine);
    expect(el.querySelector('app-gold-machine')).not.toBeNull();
    expect(el.textContent).toContain('Gold Gem Machine');
    const lever = el.querySelector<SVGGElement>('.lever')!;
    expect(lever.getAttribute('aria-disabled')).toBe('false'); // new players can afford one pull
    const game = TestBed.inject(GameStateService);
    lever.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(game.totalCracks()).toBe(1);
    expect(game.coins()).toBe(GAME_CONFIG.economy.startingCoins - GAME_CONFIG.economy.crackCost1 + GAME_CONFIG.economy.postCrackBonus);
  });

  it('Mine locks the lever when the player cannot afford a pull', () => {
    configure(Mine);
    TestBed.inject(SaveService).save = () => undefined;
    const game = TestBed.inject(GameStateService);
    (game as unknown as { state: { update(f: (s: SaveData) => SaveData): void } }).state.update((s) => ({ ...s, coins: GAME_CONFIG.economy.crackCost1 - 1 }));
    const fixture = TestBed.createComponent(Mine);
    fixture.detectChanges();
    const lever = (fixture.nativeElement as HTMLElement).querySelector<SVGGElement>('.lever')!;
    expect(lever.getAttribute('aria-disabled')).toBe('true');
  });

  it('Mine shows costs and the odds list from config', () => {
    const el = render(Mine);
    expect(el.textContent).toContain(`${GAME_CONFIG.economy.crackCost1} coins`);
    expect(el.textContent).toContain(`${GAME_CONFIG.economy.crackCost10} coins`);
    expect(el.querySelectorAll('.odds li')).toHaveLength(5);
    expect(el.textContent).toContain('Full rates and pity rules');
  });

  it('Vault starts with only locked cells and 0/24', () => {
    const el = render(Vault);
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('0/24');
    expect(el.querySelectorAll('.cell.locked')).toHaveLength(24);
  });

  it('Crew shows open and locked slots', () => {
    const el = render(Crew);
    expect(el.querySelectorAll('.slot.empty')).toHaveLength(GAME_CONFIG.crew.startSlots);
    expect(el.querySelectorAll('.slot.locked')).toHaveLength(GAME_CONFIG.crew.maxSlots - GAME_CONFIG.crew.startSlots);
  });

  it('Settings lists every rarity with base odds and the pity rules', () => {
    const el = render(Settings);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(el.textContent).toContain('60.00%');
    expect(el.textContent).toContain(`pull number ${GAME_CONFIG.pity.emeraldOrBetter}`);
    expect(el.textContent).toContain(`pull number ${GAME_CONFIG.pity.rubyOrBetter}`);
    expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
  });

  it('Settings hides the privacy policy link until a URL is configured, and ad privacy options until required', () => {
    const el = render(Settings);
    expect(el.textContent).not.toContain('Privacy policy');
    expect(el.textContent).not.toContain('Ad privacy options');
  });

  it('Intro walks through three steps with numbers from the config, then closes', () => {
    configure(IntroDialog);
    const game = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(IntroDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('.actions button')];
    expect(el.textContent).toContain('Welcome to Geode Genesis');
    expect(el.textContent).toContain(`${GAME_CONFIG.economy.idleCapHours} hours`);
    buttons()[1].click(); fixture.detectChanges();
    expect(el.textContent).toContain(`${GAME_CONFIG.economy.crackCost10}`);
    buttons()[1].click(); fixture.detectChanges();
    expect(el.textContent).toContain('never change your pull odds');
    expect(buttons()[1].textContent).toContain('Start mining');
    buttons()[1].click(); fixture.detectChanges();
    expect(game.showIntro()).toBe(false);
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });

  it('Settings offers replaying the intro', () => {
    const el = render(Settings);
    expect(el.textContent).toContain('How to play');
    expect(el.textContent).toContain('Show the intro again');
  });

  describe('result animation', () => {
    afterEach(() => vi.useRealTimers());

    it('plays pull, then drop, then opens, before showing the gem', () => {
      vi.useFakeTimers();
      configure(MineResult);
      TestBed.inject(GameStateService).crack(1);
      const fixture = TestBed.createComponent(MineResult);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const state = () => el.querySelector('svg.machine')?.getAttribute('class') ?? '';
      expect(state()).toContain('m-pulling');
      expect(el.querySelector('.gem-card')).toBeNull();

      vi.advanceTimersByTime(900);
      fixture.detectChanges();
      expect(state()).toContain('m-dropping');
      expect(el.querySelector('.gem-card')).toBeNull();

      vi.advanceTimersByTime(800);
      fixture.detectChanges();
      expect(state()).toContain('m-open');
      expect(el.querySelector('.gem-card')).not.toBeNull();
    });
  });

  it('MineResult shows a gem after a crack', () => {
    configure(MineResult);
    TestBed.inject(GameStateService).crack(1);
    const fixture = TestBed.createComponent(MineResult);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLElement>('.stage')?.click();
    fixture.detectChanges();
    expect(el.querySelector('.gem-card')).not.toBeNull();
    expect(el.textContent).toContain('NEW!');
    expect(el.textContent).toContain('Mine again');
    expect(el.textContent).toContain('Back to Mine');
  });
});
