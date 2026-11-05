import { Component, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { localDayNumber } from '../core/economy';
import { Collection } from '../core/pull';
import { ROSTER } from '../core/roster';
import { createNewSave, SaveData } from '../core/save';
import { GameStateService } from '../services/game-state.service';
import { SaveService } from '../services/save.service';
import { IntroDialog } from '../ui/intro-dialog';
import { Crew } from './crew';
import { Daily } from './daily';
import { Mine } from './mine';
import { MineResult } from './mine-result';
import { Settings } from './settings';
import { Shop } from './shop';
import { Vault } from './vault';

const E = GAME_CONFIG.economy;

class MemorySave extends SaveService {
  constructor(public stored: unknown = null) {
    super();
  }
  override load(): unknown { return this.stored; }
  override save(_: SaveData): void {}
  override clear(): void {}
}

@Component({ template: '' })
class Blank {}

const own = (ids: string[], level = 1): Collection => Object.fromEntries(ids.map((id) => [id, { level }]));
/** A save for someone who has already made their first pull. */
const played = (extra: Partial<SaveData> = {}): Partial<SaveData> => ({ totalCracks: 12, collection: own(['pebble', 'plum']), ...extra });

function configure(component: Type<unknown>, seed?: Partial<SaveData>): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
      { provide: SaveService, useValue: new MemorySave(seed ? { ...createNewSave(Date.now()), ...seed } : null) },
    ],
  });
}

function render(component: Type<unknown>, seed?: Partial<SaveData>): HTMLElement {
  configure(component, seed);
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const click = (el: Element | null): void => (el as HTMLElement).click();

describe('screens', () => {
  afterEach(() => localStorage.clear());

  describe('Daily', () => {
    it('shows the free pull, the 7-day calendar and the goals', () => {
      const el = render(Daily, played());
      expect(el.textContent).toContain('Free daily pull');
      expect(el.textContent).toContain('Pull for free');
      expect(el.querySelectorAll('.day')).toHaveLength(E.streakRewards.length);
      expect(el.querySelectorAll('.goal')).toHaveLength(GAME_CONFIG.goals.daily.length + GAME_CONFIG.goals.weekly.length);
      expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
    });

    it('claims the calendar reward', async () => {
      const el = render(Daily, played());
      const game = TestBed.inject(GameStateService);
      const before = game.coins();
      const btn = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Claim day 1'))!;
      click(btn);
      await Promise.resolve();
      expect(game.coins()).toBe(before + (E.streakRewards[0].coins ?? 0));
    });

    it('the free pull button pulls for free', () => {
      const el = render(Daily, played());
      const game = TestBed.inject(GameStateService);
      const coins = game.coins();
      click([...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Pull for free'))!);
      expect(game.totalCracks()).toBe(13);
      expect(game.coins()).toBe(coins);
    });

    it('offers a Claim button on a finished goal', () => {
      const el = render(Daily, played({ goals: { day: localDayNumber(Date.now(), new Date().getTimezoneOffset()), week: -1, dailyPulls: 12, dailyRare: 0, weeklyPulls: 12, claimed: [] } }));
      const claim = [...el.querySelectorAll<HTMLButtonElement>('.goal button')].find((b) => b.textContent?.includes('Claim'));
      expect(claim).toBeTruthy();
    });
  });

  describe('Mine', () => {
    it('shows the gold machine, whose lever makes the free first pull', () => {
      const el = render(Mine);
      expect(el.querySelector('app-gold-machine')).not.toBeNull();
      expect(el.textContent).toContain('Gold Gem Machine');
      expect(el.textContent).toContain('Your first pull is free!');
      const lever = el.querySelector<SVGGElement>('.lever')!;
      expect(lever.getAttribute('aria-disabled')).toBe('false');
      const game = TestBed.inject(GameStateService);
      lever.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(game.totalCracks()).toBe(1);
      expect(game.coins()).toBe(E.startingCoins); // the first pull was free
    });

    it('hides what is not unlocked yet: pity bars and the luck chip', () => {
      const el = render(Mine);
      expect(el.textContent).not.toContain('Pity progress');
      expect(el.querySelector('.chip')).toBeNull();
      expect(el.textContent).toContain('Full rates and pity rules'); // the disclosure is always there
      expect(el.querySelectorAll('.odds li')).toHaveLength(5);
    });

    it('shows pity bars and the luck chip once unlocked', () => {
      const el = render(Mine, played({ totalCracks: GAME_CONFIG.unlocks.pityAfterPulls, collection: own(['pebble', 'fern']) }));
      expect(el.textContent).toContain('Pity progress');
      expect(el.querySelector('.chip')).not.toBeNull();
    });

    it('shows costs, and a free x10 ticket button when you have one', () => {
      const el = render(Mine, played({ tenTickets: 2 }));
      expect(el.textContent).toContain(`${E.crackCost1} coins`);
      expect(el.textContent).toContain(`${E.crackCost10} coins`);
      expect(el.textContent).toContain('Use a free x10 pull (2)');
    });

    it('locks the lever when the player cannot afford a pull', () => {
      const el = render(Mine, played({ coins: E.crackCost1 - 1 }));
      expect(el.querySelector<SVGGElement>('.lever')!.getAttribute('aria-disabled')).toBe('true');
      expect(el.textContent).toContain('Not enough coins');
    });
  });

  describe('Vault', () => {
    it('starts with only locked cells and 0/24', () => {
      const el = render(Vault);
      expect(el.querySelector('.count')?.textContent?.trim()).toBe('0/24');
      expect(el.querySelectorAll('.cell.locked')).toHaveLength(24);
    });

    it('lists the collection rewards and set bonuses', () => {
      const el = render(Vault, played());
      expect(el.querySelectorAll('.ms li')).toHaveLength(GAME_CONFIG.progression.milestones.length);
      expect(el.querySelectorAll('.sets li')).toHaveLength(5);
      expect(el.textContent).toContain('Set bonuses');
    });

    it('claims a reached collection reward', () => {
      const el = render(Vault, played({ collection: own(ROSTER.slice(0, 6).map((g) => g.id)) }));
      const game = TestBed.inject(GameStateService);
      const before = game.coins();
      click(el.querySelector('.ms .claim'));
      expect(game.coins()).toBe(before + 200);
    });

    it('opens a gem profile when a gem is tapped, and closes it', () => {
      configure(Vault, played());
      const fixture = TestBed.createComponent(Vault);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click(el.querySelector('button.cell'));
      fixture.detectChanges();
      expect(el.querySelector('app-gem-sheet')).not.toBeNull();
      expect(el.textContent).toContain('Crew luck now');
      click([...el.querySelectorAll('app-gem-sheet button')].find((b) => b.textContent?.trim() === 'Close')!);
      fixture.detectChanges();
      expect(el.querySelector('app-gem-sheet')).toBeNull();
    });

    it('links to the shop only once it is unlocked', () => {
      expect(render(Vault, played({ totalCracks: 2 })).querySelector('.shoplink')).toBeNull();
      expect(render(Vault, played({ totalCracks: GAME_CONFIG.unlocks.shopAfterPulls })).querySelector('.shoplink')).not.toBeNull();
    });
  });

  describe('Shop', () => {
    it('shows spark progress and every missing gem with its price', () => {
      const el = render(Shop, played({ sparkProgress: 62 }));
      expect(el.textContent).toContain(`62/${GAME_CONFIG.shop.sparkAt}`);
      expect(el.querySelectorAll('.ex')).toHaveLength(22); // 24 gems, 2 owned
      const choose = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('pulls to go'));
      expect(choose?.hasAttribute('disabled')).toBe(true);
    });

    it('lets you choose any gem once the spark is ready', () => {
      configure(Shop, played({ sparkProgress: GAME_CONFIG.shop.sparkAt }));
      const fixture = TestBed.createComponent(Shop);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click([...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Choose any gem'))!);
      fixture.detectChanges();
      expect(el.querySelectorAll('.pk')).toHaveLength(24);
      click([...el.querySelectorAll('.pk')].find((b) => b.textContent?.includes('Halo'))!);
      expect(TestBed.inject(GameStateService).collection()['halo']).toEqual({ level: 1 });
    });

    it('buys a missing gem with shards', () => {
      const el = render(Shop, played({ shards: 100 }));
      const game = TestBed.inject(GameStateService);
      const buy = [...el.querySelectorAll<HTMLButtonElement>('.ex button')].find((b) => b.textContent?.includes(`${GAME_CONFIG.shop.exchangeShards.quartz} shards`))!;
      click(buy);
      expect(game.shards()).toBe(100 - GAME_CONFIG.shop.exchangeShards.quartz);
    });
  });

  describe('Crew', () => {
    it('shows open and locked slots', () => {
      const el = render(Crew, played());
      expect(el.querySelectorAll('.slot.empty')).toHaveLength(GAME_CONFIG.crew.startSlots);
      expect(el.querySelectorAll('.slot.locked')).toHaveLength(GAME_CONFIG.crew.maxSlots - GAME_CONFIG.crew.startSlots);
    });

    it('breaks total luck down by source', () => {
      const el = render(Crew, played());
      expect(el.textContent).toContain('Crew gems');
      expect(el.textContent).toContain('Completed sets');
      expect(el.textContent).toContain('Collection rewards');
    });
  });

  describe('Settings', () => {
    it('lists every rarity with base odds and the pity rules', () => {
      const el = render(Settings);
      expect(el.querySelectorAll('tbody tr')).toHaveLength(5);
      expect(el.textContent).toContain('60.00%');
      expect(el.textContent).toContain(`pull number ${GAME_CONFIG.pity.emeraldOrBetter}`);
      expect(el.textContent).toContain(`pull number ${GAME_CONFIG.pity.rubyOrBetter}`);
      expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
    });

    it('explains every source of luck, the spark and the exchange', () => {
      const el = render(Settings);
      expect(el.textContent).toContain('completed sets');
      expect(el.textContent).toContain(`Every ${GAME_CONFIG.shop.sparkAt} pulls you can choose any gem`);
      expect(el.textContent).toContain('Shards can buy a gem');
    });

    it('hides the privacy policy link until a URL is configured, and ad privacy options until required', () => {
      const el = render(Settings);
      expect(el.textContent).not.toContain('Privacy policy');
      expect(el.textContent).not.toContain('Ad privacy options');
    });

    it('offers replaying the intro', () => {
      const el = render(Settings);
      expect(el.textContent).toContain('How to play');
      expect(el.textContent).toContain('Show the intro again');
    });
  });

  it('Intro walks through three steps with numbers from the config, then closes', () => {
    configure(IntroDialog);
    const game = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(IntroDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('.actions button')];
    expect(el.textContent).toContain('Welcome to Geode Genesis');
    expect(el.textContent).toContain('first pull is free');
    buttons()[1].click(); fixture.detectChanges();
    expect(el.textContent).toContain(`every ${GAME_CONFIG.pity.emeraldOrBetter} pulls`);
    buttons()[1].click(); fixture.detectChanges();
    expect(el.textContent).toContain(`${E.crackCost10}`);
    expect(el.textContent).toContain('never change your pull odds');
    expect(buttons()[1].textContent).toContain('Start mining');
    buttons()[1].click(); fixture.detectChanges();
    expect(game.showIntro()).toBe(false);
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });

  describe('MineResult', () => {
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

    it('shows a gem after a single pull, and tells the player what it unlocked', () => {
      configure(MineResult);
      TestBed.inject(GameStateService).crack(1);
      const fixture = TestBed.createComponent(MineResult);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click(el.querySelector('.stage'));
      fixture.detectChanges();
      expect(el.querySelector('.gem-card')).not.toBeNull();
      expect(el.textContent).toContain('NEW!');
      expect(el.textContent).toContain('Vault is unlocked');
      expect(el.textContent).toContain('Mine again');
      expect(el.textContent).toContain('Back to Mine');
      expect(el.querySelector('.bonus')).toBeNull(); // the first pull is free, so no bonus coins
    });

    it('a ten-pull shows closed capsules colored by rarity, and opens them one at a time or all at once', () => {
      configure(MineResult, played({ coins: 5000 }));
      TestBed.inject(GameStateService).crack(10);
      const fixture = TestBed.createComponent(MineResult);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click(el.querySelector('.stage'));
      fixture.detectChanges();
      const capsules = () => el.querySelectorAll<HTMLElement>('button.capsule');
      expect(capsules()).toHaveLength(10);
      expect(capsules()[0].style.background).not.toBe('');
      expect(capsules()[0].getAttribute('aria-label')).toContain('capsule');
      expect(el.textContent).toContain('Tap one to open it');

      click(capsules()[0]);
      fixture.detectChanges();
      expect(capsules()).toHaveLength(9);
      expect(el.querySelectorAll('.mini app-gem-art')).toHaveLength(1);
    });

    it('open all reveals every capsule', () => {
      vi.useFakeTimers();
      configure(MineResult, played({ coins: 5000 }));
      TestBed.inject(GameStateService).crack(10);
      const fixture = TestBed.createComponent(MineResult);
      fixture.detectChanges();
      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click([...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Open all'))!);
      vi.advanceTimersByTime(1500);
      fixture.detectChanges();
      expect(el.querySelectorAll('button.capsule')).toHaveLength(0);
      expect(el.querySelectorAll('.mini app-gem-art')).toHaveLength(10);
      expect(el.textContent).toContain('new');
    });

    it('a paid pull shows the bonus coins and Mine again costs coins', () => {
      configure(MineResult, played());
      TestBed.inject(GameStateService).crack(1);
      const fixture = TestBed.createComponent(MineResult);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      click(el.querySelector('.stage'));
      fixture.detectChanges();
      expect(el.querySelector('.bonus')).not.toBeNull();
      expect(el.textContent).toContain(`Mine again · ${E.crackCost1} coins`);
    });
  });
});
