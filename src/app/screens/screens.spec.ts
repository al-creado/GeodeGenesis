import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
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

class MemorySave extends SaveService {
  override load(): unknown { return null; }
  override save(_: SaveData): void {}
  override clear(): void {}
}

function configure(component: Type<unknown>): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([]), { provide: SaveService, useClass: MemorySave }],
  });
}

function render(component: Type<unknown>): HTMLElement {
  configure(component);
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('screens', () => {
  it('Camp shows the ad disclosure and daily bonus', () => {
    const el = render(Camp);
    expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
    expect(el.querySelectorAll('.day')).toHaveLength(GAME_CONFIG.economy.dailyBonus.length);
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
    expect(el.textContent).toContain(`crack number ${GAME_CONFIG.pity.emeraldOrBetter}`);
    expect(el.textContent).toContain(`crack number ${GAME_CONFIG.pity.rubyOrBetter}`);
    expect(el.textContent).toContain('Ads are optional and never change your pull odds.');
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
