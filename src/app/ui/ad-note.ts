import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Required disclosure, shown wherever rewarded ads are offered. */
@Component({
  selector: 'app-ad-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `Ads are optional and never change your pull odds.`,
  styles: `:host { display: block; font-size: 13px; color: var(--muted); text-align: center; margin-top: 8px; }`,
})
export class AdNote {}
