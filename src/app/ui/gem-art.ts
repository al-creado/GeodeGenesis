import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ART, gemArtSpec } from '../core/gem-art';
import { shapeGeometry } from '../core/gem-shapes';
import { GemDef } from '../core/roster';

let nextUid = 0;

/**
 * Draws a gem character as inline SVG, entirely in code: body shape, facets,
 * cute face, and an optional rarity frame. The look is derived from the gem id.
 */
@Component({
  selector: 'app-gem-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gem-art.html',
  styleUrl: './gem-art.scss',
})
export class GemArt {
  readonly gem = input.required<GemDef>();
  /** Draw the rarity frame around the gem. */
  readonly framed = input(true);

  protected readonly uid = `ga${nextUid++}`;
  protected readonly art = ART;
  protected readonly spec = computed(() => gemArtSpec(this.gem()));
  protected readonly geo = computed(() => shapeGeometry(this.spec().shape));
  protected readonly label = computed(() => `${this.gem().name}, ${this.gem().rarity} gem`);
  protected readonly rarity = computed(() => this.gem().rarity);

  /** Pre-computed face geometry in the 100x100 gem box. */
  protected readonly face = computed(() => {
    const { cx, cy, width } = this.geo().face;
    const f = this.spec().face;
    const eyeDx = width * f.eyeSpread;
    const eyeY = cy - 2;
    const half = (width * f.smileWidth) / 2 + 2;
    const sy = cy + 5;
    const smile = f.openSmile
      ? `M${cx - half} ${sy} Q${cx} ${sy + 8} ${cx + half} ${sy} Z`
      : `M${cx - half} ${sy} Q${cx} ${sy + 4.5} ${cx + half} ${sy}`;
    return {
      eyeL: { x: cx - eyeDx, y: eyeY },
      eyeR: { x: cx + eyeDx, y: eyeY },
      eyeRadius: f.eyeRadius,
      highlight: f.eyeRadius * 0.38,
      smile,
      open: f.openSmile,
      blushL: { x: cx - eyeDx - 3.5, y: cy + 3.5 },
      blushR: { x: cx + eyeDx + 3.5, y: cy + 3.5 },
      blushOpacity: f.blushOpacity,
    };
  });
}
