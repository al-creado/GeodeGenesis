/** Injectable random source returning floats in [0, 1). */
export interface Rng {
  next(): number;
}

/** Deterministic seeded RNG (mulberry32). */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Production RNG backed by Math.random. */
export const mathRng: Rng = { next: () => Math.random() };

/** Test helper: replays a fixed list of values, repeating the last one. */
export function createSequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return {
    next(): number {
      const v = values[Math.min(i, values.length - 1)];
      i++;
      return v;
    },
  };
}
