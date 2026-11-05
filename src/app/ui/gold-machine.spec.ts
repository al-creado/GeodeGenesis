import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GoldMachine, MachineState } from './gold-machine';

@Component({
  imports: [GoldMachine],
  template: `<app-gold-machine [state]="state()" [cost]="cost" [leverEnabled]="enabled()" [glow]="'#FF6B8A'" (lever)="pulls = pulls + 1" />`,
})
class Host {
  state = signal<MachineState>('idle');
  enabled = signal(true);
  cost = 100;
  pulls = 0;
}

function render(): { el: HTMLElement; host: Host; detect: () => void } {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, detect: () => fixture.detectChanges() };
}

describe('GoldMachine', () => {
  it('draws the machine with the cost on its coin plate', () => {
    const { el } = render();
    expect(el.querySelector('svg[role=group]')?.getAttribute('aria-label')).toContain('gold gem machine');
    expect(el.querySelector('text')?.textContent?.trim()).toBe('100');
    expect(el.querySelectorAll('.ball').length).toBeGreaterThanOrEqual(10);
  });

  it('shows each state as a class so CSS can animate it', () => {
    const { el, host, detect } = render();
    for (const state of ['idle', 'pulling', 'dropping', 'open'] as const) {
      host.state.set(state);
      detect();
      expect(el.querySelector('svg')?.classList.contains(`m-${state}`)).toBe(true);
    }
  });

  it('emits when the lever is clicked or activated by keyboard', () => {
    const { el, host } = render();
    const lever = el.querySelector<SVGGElement>('.lever')!;
    expect(lever.getAttribute('role')).toBe('button');
    lever.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    lever.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    lever.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(host.pulls).toBe(3);
  });

  it('ignores the lever and drops it from the tab order when it cannot be used', () => {
    const { el, host, detect } = render();
    host.enabled.set(false);
    detect();
    const lever = el.querySelector<SVGGElement>('.lever')!;
    lever.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.pulls).toBe(0);
    expect(lever.getAttribute('tabindex')).toBe('-1');
    expect(lever.getAttribute('aria-disabled')).toBe('true');
  });

  it('glows in the given color when the capsule opens', () => {
    const { el } = render();
    const stops = [...el.querySelectorAll('radialGradient stop')].map((s) => s.getAttribute('stop-color'));
    expect(stops).toContain('#FF6B8A');
  });
});
