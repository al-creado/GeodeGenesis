import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = `${process.cwd()}/src/app/core`;

describe('core module purity', () => {
  it('has no Angular, Capacitor or rxjs imports', () => {
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .filter((f) => /from\s+['"](@angular|@capacitor|rxjs)/.test(readFileSync(`${dir}/${f}`, 'utf8')))
      .sort();
    expect(offenders).toEqual([]);
  });
});
