import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { createNewSave, SaveData } from '../core/save';
import { CLOUD_BACKEND, CloudBackend, NoCloudBackend } from './cloud-backend';
import { CloudSyncService, UPLOAD_DEBOUNCE_MS } from './cloud-sync.service';
import { GameStateService } from './game-state.service';
import { REMOTE_CONFIG_CACHE_KEY, RemoteConfigService } from './remote-config.service';
import { SaveService } from './save.service';
import { CLOCK, CONFIG, RNG } from './tokens';
import { createSequenceRng } from '../core/rng';

class MemorySave extends SaveService {
  stored: unknown = null;
  override load(): unknown { return this.stored; }
  override save(d: SaveData): void { this.stored = JSON.parse(JSON.stringify(d)); }
  override clear(): void { this.stored = null; }
}

class FakeBackend implements CloudBackend {
  available = true;
  cloud: unknown = null;
  signInError: Error | null = null;
  writes: { uid: string; data: SaveData; savedAt: number }[] = [];
  remoteText = '';
  remoteDelayMs = 0;
  remoteError: Error | null = null;
  async signIn(): Promise<string> { if (this.signInError) throw this.signInError; return 'uid-1'; }
  async loadSave(): Promise<unknown> { return this.cloud; }
  async writeSave(uid: string, data: unknown, savedAt: number): Promise<void> {
    this.writes.push({ uid, data: data as SaveData, savedAt });
    this.cloud = data;
  }
  async fetchRemoteConfig(): Promise<string> {
    if (this.remoteDelayMs) await new Promise((r) => setTimeout(r, this.remoteDelayMs));
    if (this.remoteError) throw this.remoteError;
    return this.remoteText;
  }
}

const T0 = 1_700_000_000_000;

describe('CloudSyncService', () => {
  let now: number;
  let storage: MemorySave;
  let backend: FakeBackend;

  function setup(): { sync: CloudSyncService; game: GameStateService } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SaveService, useValue: storage },
        { provide: CLOUD_BACKEND, useValue: backend },
        { provide: CLOCK, useValue: () => now },
        { provide: RNG, useValue: createSequenceRng([0]) },
      ],
    });
    return { sync: TestBed.inject(CloudSyncService), game: TestBed.inject(GameStateService) };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    now = T0;
    storage = new MemorySave();
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  const cloudSave = (patch: Partial<SaveData>): SaveData => ({ ...createNewSave(T0), ...patch });

  it('stays off when Firebase is not configured', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SaveService, useValue: storage }, { provide: CLOUD_BACKEND, useValue: new NoCloudBackend() }] });
    const sync = TestBed.inject(CloudSyncService);
    await sync.start();
    expect(sync.status()).toBe('off');
  });

  it('does not upload an untouched new game', async () => {
    const { sync } = setup();
    await sync.start();
    expect(sync.status()).toBe('synced');
    expect(backend.writes).toHaveLength(0);
  });

  it('downloads a newer cloud save into the game', async () => {
    backend.cloud = cloudSave({ coins: 4321, totalCracks: 40, collection: { halo: { level: 3 } }, savedAt: T0 + 5000 });
    const { sync, game } = setup();
    await sync.start();
    expect(game.coins()).toBe(4321);
    expect(game.collection()['halo'].level).toBe(3);
    expect((storage.stored as SaveData).coins).toBe(4321); // also saved locally
    expect(backend.writes).toHaveLength(0);
    expect(sync.status()).toBe('synced');
  });

  it('uploads the local save when it is newer', async () => {
    const { sync, game } = setup();
    game.crack(1);
    backend.cloud = cloudSave({ coins: 1, totalCracks: 2, collection: { pebble: { level: 1 } }, savedAt: T0 - 1000 });
    await sync.start();
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0].uid).toBe('uid-1');
    expect(backend.writes[0].data.totalCracks).toBe(1);
  });

  it('uploads changes after the debounce, batching rapid edits', async () => {
    const { sync, game } = setup();
    await sync.start();
    now += 1000;
    game.crack(1);
    TestBed.tick();
    now += 1000;
    game.crack(1);
    TestBed.tick();
    expect(backend.writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS + 10);
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0].data.totalCracks).toBe(2);
    expect(sync.status()).toBe('synced');
  });

  it('flush uploads immediately', async () => {
    const { sync, game } = setup();
    await sync.start();
    now += 1000;
    game.crack(1);
    await sync.flush();
    expect(backend.writes).toHaveLength(1);
  });

  it('never overwrites a cloud save it cannot read', async () => {
    backend.cloud = { version: GAME_CONFIG.saveVersion + 5, coins: 999 };
    const { sync, game } = setup();
    game.crack(1);
    await sync.start();
    expect(sync.status()).toBe('error');
    now += 1000;
    game.crack(1);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(UPLOAD_DEBOUNCE_MS + 10);
    await sync.flush();
    expect(backend.writes).toHaveLength(0);
  });

  it('keeps local progress when sign-in fails', async () => {
    backend.signInError = new Error('offline');
    const { sync, game } = setup();
    game.crack(1);
    await sync.start();
    expect(sync.status()).toBe('error');
    expect(sync.message()).toBe('offline');
    expect(game.totalCracks()).toBe(1);
    expect(backend.writes).toHaveLength(0);
  });

  it('can retry with Sync now after a failure', async () => {
    backend.signInError = new Error('offline');
    const { sync, game } = setup();
    now += 10;
    game.crack(1);
    await sync.start();
    backend.signInError = null;
    await sync.start();
    expect(sync.status()).toBe('synced');
    expect(backend.writes).toHaveLength(1);
  });
});

describe('RemoteConfigService', () => {
  let backend: FakeBackend;

  function make(): RemoteConfigService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOUD_BACKEND, useValue: backend }] });
    return TestBed.inject(RemoteConfigService);
  }

  beforeEach(() => {
    localStorage.clear();
    backend = new FakeBackend();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('uses built-in defaults when Firebase is off', async () => {
    backend.available = false;
    const rc = make();
    await rc.load();
    expect(rc.config).toBe(GAME_CONFIG);
    expect(rc.source()).toBe('defaults');
  });

  it('applies fresh overrides before the game starts and feeds the CONFIG token', async () => {
    backend.remoteText = JSON.stringify({ economy: { crackCost1: 80, crackCost10: 720 } });
    const rc = make();
    await rc.load();
    expect(rc.source()).toBe('fresh');
    expect(TestBed.inject(CONFIG).economy.crackCost1).toBe(80);
    expect(TestBed.inject(CONFIG).economy.crackCost10).toBe(720);
    expect(localStorage.getItem(REMOTE_CONFIG_CACHE_KEY)).toContain('720');
  });

  it('ignores invalid overrides', async () => {
    backend.remoteText = JSON.stringify({ baseOdds: { quartz: 10 }, economy: { crackCost1: 'free' } });
    const rc = make();
    await rc.load();
    expect(rc.config).toBe(GAME_CONFIG);
    expect(rc.source()).toBe('defaults');
  });

  it('starts from the cached overrides when offline', async () => {
    localStorage.setItem(REMOTE_CONFIG_CACHE_KEY, JSON.stringify({ pity: { emeraldOrBetter: 7 } }));
    backend.remoteError = new Error('offline');
    const rc = make();
    expect(rc.config.pity.emeraldOrBetter).toBe(7);
    expect(rc.source()).toBe('cached');
    await rc.load();
    expect(rc.config.pity.emeraldOrBetter).toBe(7);
  });

  it('does not change the config mid-session when the fetch is slow, but caches it', async () => {
    vi.useFakeTimers();
    backend.remoteDelayMs = 10_000;
    backend.remoteText = JSON.stringify({ economy: { crackCost1: 50 } });
    const rc = make();
    const loading = rc.load(3000);
    await vi.advanceTimersByTimeAsync(3100);
    await loading;
    expect(rc.config).toBe(GAME_CONFIG);
    await vi.advanceTimersByTimeAsync(8000);
    expect(localStorage.getItem(REMOTE_CONFIG_CACHE_KEY)).toContain('50');
    expect(rc.config).toBe(GAME_CONFIG);
  });
});
