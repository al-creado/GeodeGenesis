import { effect, inject, Injectable, signal } from '@angular/core';
import { chooseSave } from '../core/cloud-sync';
import { migrateSave, SaveData } from '../core/save';
import { CLOUD_BACKEND } from './cloud-backend';
import { GameStateService } from './game-state.service';
import { CLOCK, CONFIG } from './tokens';

/** off: not configured. disabled: the player turned cloud save off. */
export type CloudStatus = 'off' | 'disabled' | 'syncing' | 'synced' | 'error';

/** How long to wait after the last change before uploading. */
export const UPLOAD_DEBOUNCE_MS = 5000;

/**
 * Keeps the local save and the Firestore cloud save in step.
 * On start the newest save wins; after that every change is uploaded (debounced).
 * Local play never waits for the cloud, and failures never lose local progress.
 */
@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private readonly backend = inject(CLOUD_BACKEND);
  private readonly game = inject(GameStateService);
  private readonly clock = inject(CLOCK);
  private readonly config = inject(CONFIG);

  readonly status = signal<CloudStatus>(this.backend.available ? 'syncing' : 'off');
  readonly lastSyncedAt = signal<number | null>(null);
  readonly message = signal('');

  private uid: string | null = null;
  /** True once the first reconcile succeeded; uploads wait for this. */
  private ready = false;
  /** Set when the cloud holds data we can't read: never overwrite it. */
  private blocked = false;
  private uploadedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const snap = this.game.snapshot();
      if (this.ready && !this.blocked && this.game.cloudSaveEnabled() && snap.savedAt > this.uploadedAt) this.schedule();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.flush();
      });
    }
  }

  /** Sign in, then reconcile local and cloud saves. Safe to call again (Sync now). */
  async start(): Promise<void> {
    if (!this.backend.available) {
      this.status.set('off');
      return;
    }
    if (!this.game.cloudSaveEnabled()) {
      this.status.set('disabled');
      return;
    }
    this.status.set('syncing');
    this.message.set('');
    try {
      this.uid ??= await this.backend.signIn();
      const raw = await this.backend.loadSave(this.uid);
      const cloud = raw === null || raw === undefined ? null : migrateSave(raw, this.clock(), this.config);
      if (raw !== null && raw !== undefined && !cloud) {
        // Newer app version or unreadable data: leave the cloud copy alone.
        this.blocked = true;
        this.fail('The cloud save is from a newer version of the game or is unreadable, so it was left untouched.');
        return;
      }
      this.blocked = false;
      const local = this.game.snapshot();
      switch (chooseSave(local, cloud)) {
        case 'download':
          this.game.importSave(cloud as SaveData);
          this.uploadedAt = (cloud as SaveData).savedAt;
          break;
        case 'upload':
          await this.upload(local);
          break;
        case 'same':
          this.uploadedAt = local.savedAt;
          break;
      }
      this.ready = true;
      this.markSynced();
    } catch (e) {
      this.fail(e instanceof Error ? e.message : 'Could not reach the cloud.');
    }
  }

  /** Upload right away if there are unsynced changes. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const snap = this.game.snapshot();
    if (!this.ready || this.blocked || !this.uid || !this.game.cloudSaveEnabled() || snap.savedAt <= this.uploadedAt) return;
    try {
      await this.upload(snap);
      this.markSynced();
    } catch (e) {
      this.fail(e instanceof Error ? e.message : 'Could not reach the cloud.');
    }
  }

  /**
   * Delete the cloud save and stop syncing. Local progress is kept.
   * If the delete fails, nothing changes so the player can try again.
   */
  async deleteCloudData(): Promise<void> {
    if (!this.backend.available) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.status.set('syncing');
    try {
      this.uid ??= await this.backend.signIn();
      await this.backend.deleteCloudData(this.uid);
    } catch (e) {
      this.fail(`Could not delete your cloud data. Check your connection and try again. (${e instanceof Error ? e.message : 'unknown error'})`);
      return;
    }
    this.ready = false;
    this.uid = null;
    this.uploadedAt = 0;
    this.game.setCloudSave(false);
    this.lastSyncedAt.set(null);
    this.status.set('disabled');
    this.message.set('Your cloud data was deleted. Progress stays on this device.');
  }

  /** Turn cloud save back on after it was disabled. */
  async enableCloud(): Promise<void> {
    this.game.setCloudSave(true);
    await this.start();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), UPLOAD_DEBOUNCE_MS);
  }

  private async upload(data: SaveData): Promise<void> {
    if (!this.uid) throw new Error('Not signed in');
    await this.backend.writeSave(this.uid, JSON.parse(JSON.stringify(data)), data.savedAt);
    this.uploadedAt = data.savedAt;
  }

  private markSynced(): void {
    this.status.set('synced');
    this.lastSyncedAt.set(this.clock());
    this.message.set('');
  }

  private fail(message: string): void {
    this.status.set('error');
    this.message.set(message);
  }
}
