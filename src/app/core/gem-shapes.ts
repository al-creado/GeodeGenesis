/** Pure SVG geometry for the five gem shapes, in a 100x100 box. */

export const GEM_SHAPES = ['point', 'kite', 'step', 'heart', 'brilliant'] as const;
export type GemShape = (typeof GEM_SHAPES)[number];

export interface Facet {
  readonly d: string;
  readonly tone: 'light' | 'dark';
}

export interface ShapeGeometry {
  readonly outline: string;
  readonly facets: readonly Facet[];
  /** Thin facet lines drawn over the body. */
  readonly lines: string;
  /** Where the cute face sits, and how wide it may be. */
  readonly face: { readonly cx: number; readonly cy: number; readonly width: number };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Point on a circle around (50,50); angle in degrees, 0 = right, y grows down. */
function pt(angleDeg: number, radius: number): string {
  const a = (angleDeg * Math.PI) / 180;
  return `${r2(50 + radius * Math.cos(a))} ${r2(50 + radius * Math.sin(a))}`;
}

function brilliant(): ShapeGeometry {
  const table = 30;
  const rim = 44;
  const tableVerts = Array.from({ length: 8 }, (_, k) => 22.5 + 45 * k);
  const tablePath = 'M' + tableVerts.map((a) => pt(a, table)).join(' L') + ' Z';
  const star = tableVerts
    .map((a) => `M${pt(a, table)} L${pt(a - 22.5, rim)} M${pt(a, table)} L${pt(a + 22.5, rim)}`)
    .join(' ');
  return {
    outline: `M${pt(0, rim)} ` + Array.from({ length: 47 }, (_, k) => `L${pt(7.5 * (k + 1), rim)}`).join(' ') + ' Z',
    facets: [
      { d: `M${pt(202.5, table)} L${pt(225, rim)} L${pt(247.5, table)} Z`, tone: 'light' },
      { d: `M${pt(22.5, table)} L${pt(45, rim)} L${pt(67.5, table)} Z`, tone: 'dark' },
    ],
    lines: `${tablePath} ${star}`,
    face: { cx: 50, cy: 50, width: 40 },
  };
}

const GEOMETRY: Record<Exclude<GemShape, 'brilliant'>, ShapeGeometry> = {
  point: {
    outline: 'M28 92 V40 L50 8 L72 40 V92 Z',
    facets: [
      { d: 'M28 40 L50 8 L50 40 Z', tone: 'light' },
      { d: 'M50 8 L72 40 L50 40 Z', tone: 'dark' },
    ],
    lines: 'M28 40 H72 M50 8 V40',
    face: { cx: 50, cy: 66, width: 34 },
  },
  kite: {
    outline: 'M50 6 L86 40 L50 94 L14 40 Z',
    facets: [
      { d: 'M50 6 L14 40 L50 40 Z', tone: 'light' },
      { d: 'M50 40 L86 40 L50 94 Z', tone: 'dark' },
    ],
    lines: 'M14 40 H86 M50 6 V40',
    face: { cx: 50, cy: 58, width: 30 },
  },
  step: {
    outline: 'M30 8 H70 L92 30 V70 L70 92 H30 L8 70 V30 Z',
    facets: [
      { d: 'M30 8 H70 L66 24 H34 Z', tone: 'light' },
      { d: 'M30 92 H70 L66 76 H34 Z', tone: 'dark' },
    ],
    lines: 'M34 24 H66 L78 36 V64 L66 76 H34 L22 64 V36 Z M30 8 L34 24 M70 8 L66 24 M92 30 L78 36 M92 70 L78 64 M70 92 L66 76 M30 92 L34 76 M8 70 L22 64 M8 30 L22 36',
    face: { cx: 50, cy: 50, width: 44 },
  },
  heart: {
    outline:
      'M50 90 C20 68 6 50 6 32 C6 17 17 8 29 8 C39 8 46 14 50 22 C54 14 61 8 71 8 C83 8 94 17 94 32 C94 50 80 68 50 90 Z',
    facets: [
      { d: 'M14 28 C14 20 20 14 28 14 C33 14 37 16 40 20 C30 20 22 25 20 36 C16 34 14 31 14 28 Z', tone: 'light' },
      { d: 'M50 90 C66 79 78 68 86 52 C82 68 68 80 50 84 Z', tone: 'dark' },
    ],
    lines: '',
    face: { cx: 50, cy: 46, width: 44 },
  },
  // brilliant is generated below
} as Record<Exclude<GemShape, 'brilliant'>, ShapeGeometry>;

const BRILLIANT = brilliant();

export function shapeGeometry(shape: GemShape): ShapeGeometry {
  return shape === 'brilliant' ? BRILLIANT : GEOMETRY[shape];
}
