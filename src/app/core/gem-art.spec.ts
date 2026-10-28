import { describe, expect, it } from 'vitest';
import { RARITIES } from './config';
import { ART, gemArtSpec, hashId } from './gem-art';
import { GEM_SHAPES, shapeGeometry } from './gem-shapes';
import { ROSTER } from './roster';

describe('hashId', () => {
  it('is stable and distinguishes ids', () => {
    expect(hashId('pebble')).toBe(hashId('pebble'));
    expect(hashId('pebble')).not.toBe(hashId('frost'));
  });
});

describe('gemArtSpec', () => {
  it('is deterministic per gem', () => {
    for (const g of ROSTER) expect(gemArtSpec(g)).toEqual(gemArtSpec(g));
  });

  it('uses every one of the five shapes somewhere in the roster', () => {
    const used = new Set(ROSTER.map((g) => gemArtSpec(g).shape));
    for (const s of GEM_SHAPES) expect(used).toContain(s);
  });

  it('keeps colors inside each rarity pool, with Diamond iridescent', () => {
    for (const g of ROSTER) {
      const spec = gemArtSpec(g);
      if (g.rarity === 'diamond') expect(spec.color).toBe('diamond');
      else expect(Object.keys(ART.palette)).toContain(spec.color);
    }
  });

  it('gives Emerald gems an emerald or citrine fill and Ruby gems a ruby or rose fill', () => {
    for (const g of ROSTER.filter((x) => x.rarity === 'emerald')) expect(['emerald', 'citrine']).toContain(gemArtSpec(g).color);
    for (const g of ROSTER.filter((x) => x.rarity === 'ruby')) expect(['ruby', 'rose']).toContain(gemArtSpec(g).color);
  });

  it('keeps face parameters in a cute range', () => {
    for (const g of ROSTER) {
      const f = gemArtSpec(g).face;
      expect(f.eyeSpread).toBeGreaterThanOrEqual(0.26);
      expect(f.eyeSpread).toBeLessThanOrEqual(0.34);
      expect(f.eyeRadius).toBeGreaterThanOrEqual(2.8);
      expect(f.eyeRadius).toBeLessThanOrEqual(3.6);
    }
  });

  it('shows some visual variety within a rarity', () => {
    for (const r of RARITIES.filter((x) => x === 'quartz' || x === 'amethyst')) {
      const looks = new Set(ROSTER.filter((g) => g.rarity === r).map((g) => `${gemArtSpec(g).shape}/${gemArtSpec(g).color}`));
      expect(looks.size).toBeGreaterThan(2);
    }
  });
});

describe('shapeGeometry', () => {
  it.each(GEM_SHAPES)('%s has an outline, facets and a face spot inside the box', (shape) => {
    const g = shapeGeometry(shape);
    expect(g.outline.startsWith('M')).toBe(true);
    expect(g.facets.length).toBeGreaterThan(0);
    expect(g.face.cx).toBeGreaterThan(0);
    expect(g.face.cx + g.face.width / 2).toBeLessThanOrEqual(100);
    expect(g.face.cy).toBeGreaterThan(0);
    expect(g.face.cy).toBeLessThan(100);
  });
  it('never emits NaN coordinates', () => {
    for (const s of GEM_SHAPES) {
      const g = shapeGeometry(s);
      expect(`${g.outline} ${g.lines} ${g.facets.map((f) => f.d).join(' ')}`).not.toContain('NaN');
    }
  });
});
