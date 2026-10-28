import { Rarity } from './config';
import { GEM_SHAPES, GemShape } from './gem-shapes';
import { GemDef } from './roster';
import { createSeededRng } from './rng';

/** Visual constants. Colors and stroke come from the style guide. */
export const ART = {
  outline: '#24160F',
  strokeWidth: 2.5,
  palette: {
    rose: '#F4C2D7',
    citrine: '#FFD36B',
    amethyst: '#B58CFF',
    sapphire: '#6FA8FF',
    emerald: '#3FC28F',
    ruby: '#FF6B8A',
  },
  /** Soft pastel stops for the iridescent Diamond fill. */
  diamondStops: ['#FFFFFF', '#FFD9EC', '#D9E8FF', '#D5FFF0', '#FFF6CF', '#FFFFFF'],
  frame: {
    quartz: '#C9C3D8',
    amethyst: '#B58CFF',
    emerald: '#3FC28F',
    ruby: '#FF6B8A',
    rubyWarm: '#F2B84B',
    rainbow: ['#FF6B8A', '#FFD36B', '#3FC28F', '#6FA8FF', '#B58CFF'],
  },
} as const;

export type PaletteKey = keyof typeof ART.palette;
export type GemColor = PaletteKey | 'diamond';

/** Which fill colors each rarity may use (picked by gem id). */
const COLOR_POOL: Readonly<Record<Rarity, readonly GemColor[]>> = {
  quartz: ['rose', 'citrine', 'sapphire'],
  amethyst: ['amethyst', 'sapphire'],
  emerald: ['emerald', 'citrine'],
  ruby: ['ruby', 'rose'],
  diamond: ['diamond'],
};

export interface GemArtSpec {
  readonly id: string;
  readonly rarity: Rarity;
  readonly shape: GemShape;
  readonly color: GemColor;
  /** Hex fill; for Diamond this is the base white (gradient is applied by the renderer). */
  readonly fill: string;
  readonly face: {
    /** Eye offset from face center, as a fraction of face width. */
    readonly eyeSpread: number;
    readonly eyeRadius: number;
    readonly smileWidth: number;
    readonly openSmile: boolean;
    readonly blushOpacity: number;
  };
}

/** FNV-1a 32-bit hash of the gem id. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic look for a gem, derived only from its id and rarity. */
export function gemArtSpec(gem: Pick<GemDef, 'id' | 'rarity'>): GemArtSpec {
  const rng = createSeededRng(hashId(gem.id));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)];
  const shape = pick(GEM_SHAPES);
  const color = pick(COLOR_POOL[gem.rarity]);
  const between = (lo: number, hi: number): number => lo + rng.next() * (hi - lo);
  return {
    id: gem.id,
    rarity: gem.rarity,
    shape,
    color,
    fill: color === 'diamond' ? '#FFFFFF' : ART.palette[color],
    face: {
      eyeSpread: round(between(0.26, 0.34)),
      eyeRadius: round(between(2.8, 3.6)),
      smileWidth: round(between(0.18, 0.3)),
      openSmile: rng.next() < 0.35,
      blushOpacity: round(between(0.45, 0.65)),
    },
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
