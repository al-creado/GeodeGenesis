import { Injectable } from '@angular/core';
import { SaveData } from '../core/save';

/** Where saves live. localStorage today; Firebase cloud save joins in Stage 5. */
@Injectable({ providedIn: 'root', useFactory: () => new LocalStorageSaveService() })
export abstract class SaveService {
  /** Raw stored data (unvalidated), or null when nothing is stored. */
  abstract load(): unknown;
  abstract save(data: SaveData): void;
  abstract clear(): void;
}

export const SAVE_KEY = 'geode-genesis-save';

export class LocalStorageSaveService extends SaveService {
  override load(): unknown {
    try {
      const text = localStorage.getItem(SAVE_KEY);
      return text === null ? null : JSON.parse(text);
    } catch {
      return null;
    }
  }

  override save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable: the game keeps running from memory.
    }
  }

  override clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
  }
}
