import { inject, Injectable, signal } from '@angular/core';
import { GAME_CONFIG, GameConfig } from '../core/config';
import { parseRemoteConfigJson } from '../core/remote-config';
import { CLOUD_BACKEND } from './cloud-backend';

export const REMOTE_CONFIG_CACHE_KEY = 'geode-genesis-remote-config';

/**
 * Holds the active game config: built-in defaults plus validated Remote Config overrides.
 * The config is fixed for the whole session. A fetch that finishes after startup is only
 * cached, and takes effect on the next launch, so numbers never change under the player.
 */
@Injectable({ providedIn: 'root' })
export class RemoteConfigService {
  private readonly backend = inject(CLOUD_BACKEND);

  /** Groups the last applied override changed (for debugging). */
  readonly applied = signal<readonly string[]>([]);
  /** The config the app runs with this session. */
  config: GameConfig = this.fromText(this.readCache());
  readonly source = signal<'defaults' | 'cached' | 'fresh'>(this.config === GAME_CONFIG ? 'defaults' : 'cached');

  /** Fetch Remote Config, waiting at most `timeoutMs` so startup never hangs. */
  async load(timeoutMs = 3000): Promise<void> {
    if (!this.backend.available) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const fetched = this.backend.fetchRemoteConfig().then((text) => {
        this.writeCache(text);
        return text;
      });
      fetched.catch(() => undefined); // a late failure is harmless
      const text = await Promise.race([
        fetched,
        new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), timeoutMs))),
      ]);
      if (text !== null) {
        this.config = this.fromText(text);
        this.source.set(this.config === GAME_CONFIG ? 'defaults' : 'fresh');
      }
    } catch {
      // Offline or misconfigured: keep cached/default numbers.
    } finally {
      clearTimeout(timer);
    }
  }

  private fromText(text: string | null): GameConfig {
    const result = parseRemoteConfigJson(text, GAME_CONFIG);
    this.applied.set(result.applied);
    return result.applied.length > 0 ? result.config : GAME_CONFIG;
  }

  private readCache(): string | null {
    try {
      return localStorage.getItem(REMOTE_CONFIG_CACHE_KEY);
    } catch {
      return null;
    }
  }

  private writeCache(text: string): void {
    try {
      localStorage.setItem(REMOTE_CONFIG_CACHE_KEY, text);
    } catch {
      // ignore
    }
  }
}
