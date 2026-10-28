import { ChangeDetectionStrategy, Component } from '@angular/core';

/** [x, width, height] of each stalactite on a 400x44 strip. */
const SPIKES: readonly (readonly [number, number, number])[] = [
  [0, 34, 26], [30, 26, 40], [52, 30, 22], [80, 36, 34], [112, 24, 18], [134, 32, 42],
  [164, 28, 24], [190, 36, 32], [222, 26, 38], [246, 30, 20], [274, 34, 36], [306, 24, 24],
  [328, 32, 40], [358, 26, 22], [380, 28, 30],
];

const PATH =
  'M0 0 H400 V4 ' +
  [...SPIKES]
    .reverse()
    .map(([x, w, h]) => `L${x + w} 4 L${x + w / 2} ${h} L${x} 4`)
    .join(' ') +
  ' Z';

/** Decorative stalactites hanging along the top edge of a screen. */
@Component({
  selector: 'app-stalactites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 400 44" preserveAspectRatio="none" aria-hidden="true">
    <path [attr.d]="path" fill="#1C120C" />
  </svg>`,
  styles: `
    :host { position: absolute; top: 0; left: 0; right: 0; height: 44px; pointer-events: none; z-index: 1; }
    svg { display: block; width: 100%; height: 100%; }
  `,
})
export class Stalactites {
  protected readonly path = PATH;
}
