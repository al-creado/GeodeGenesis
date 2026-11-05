import { describe, expect, it } from 'vitest';
import { chooseSave, hasProgress } from './cloud-sync';
import { createNewSave } from './save';

const at = (savedAt: number) => ({ ...createNewSave(1), savedAt });

describe('chooseSave', () => {
  it('uploads local progress when there is no cloud save', () => {
    expect(chooseSave(at(500), null)).toBe('upload');
  });
  it('does nothing for an untouched new game with no cloud save', () => {
    expect(chooseSave(at(0), null)).toBe('same');
  });
  it('downloads when the cloud save is newer', () => {
    expect(chooseSave(at(100), at(200))).toBe('download');
  });
  it('uploads when the local save is newer', () => {
    expect(chooseSave(at(300), at(200))).toBe('upload');
  });
  it('is a no-op when both match', () => {
    expect(chooseSave(at(200), at(200))).toBe('same');
  });
  it('does not let a local game with no progress overwrite a cloud save that has some', () => {
    const cloud = { ...at(100), totalCracks: 12, collection: { pebble: { level: 1 } } };
    const freshButTouched = at(900); // e.g. the player tapped Collect before sync finished
    expect(hasProgress(freshButTouched)).toBe(false);
    expect(hasProgress(cloud)).toBe(true);
    expect(chooseSave(freshButTouched, cloud)).toBe('download');
  });
  it('still lets real local progress win when it is newer', () => {
    const local = { ...at(900), totalCracks: 3, collection: { plum: { level: 1 } } };
    const cloud = { ...at(100), totalCracks: 12, collection: { pebble: { level: 1 } } };
    expect(chooseSave(local, cloud)).toBe('upload');
  });
  it('never lets a fresh install overwrite an existing cloud save', () => {
    expect(chooseSave(at(0), at(1))).toBe('download');
  });
});
