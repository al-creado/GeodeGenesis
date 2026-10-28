import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdService, SimulatedAdService } from '../services/ad.service';

/** Fake ad overlay for the browser. Only renders when the Simulated provider is active. */
@Component({
  selector: 'app-ad-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sim && sim.dialog(); as d) {
      <div class="backdrop">
        <div class="box" role="dialog" aria-modal="true" aria-labelledby="ad-title">
          <h2 id="ad-title">Simulated ad</h2>
          <p>This stands in for a real rewarded ad. Your reward arrives when it finishes.</p>
          <div class="bar" role="progressbar" aria-label="Ad progress" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
            <div class="fill" [style.width.%]="progress()"></div>
          </div>
          <p class="time">{{ seconds() }}s left</p>
          <button type="button" class="btn btn-quiet" (click)="sim.cancel()">Close (no reward)</button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(15, 8, 4, 0.82); display: grid; place-items: center; padding: 24px; }
    .box { width: min(340px, 100%); background: var(--card); border: 2px solid var(--card-border); border-radius: 18px; padding: 20px; text-align: center; }
    h2 { margin: 0 0 8px; }
    p { margin: 0 0 12px; font-size: 14px; color: var(--muted); }
    .bar { height: 12px; border-radius: 6px; background: var(--nav); overflow: hidden; margin-bottom: 8px; }
    .fill { height: 100%; background: var(--amber); transition: width 0.1s linear; }
    .time { color: var(--text); }
  `,
})
export class AdDialog {
  protected readonly sim = (() => {
    const ads = inject(AdService);
    return ads instanceof SimulatedAdService ? ads : null;
  })();

  protected readonly progress = computed(() => {
    const d = this.sim?.dialog();
    return d ? Math.round(((d.totalMs - d.remainingMs) / d.totalMs) * 100) : 0;
  });
  protected readonly seconds = computed(() => Math.ceil((this.sim?.dialog()?.remainingMs ?? 0) / 1000));
}
