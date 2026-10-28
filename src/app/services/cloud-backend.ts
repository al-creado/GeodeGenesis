import { InjectionToken } from '@angular/core';
import { FIREBASE_CONFIG } from '../firebase.config';
import { FirebaseBackend } from './firebase-backend';

/** Everything the app needs from the cloud, so it can be faked in tests. */
export interface CloudBackend {
  /** False when Firebase isn't configured: the app then runs local-only. */
  readonly available: boolean;
  /** Anonymous sign-in; resolves to the player's uid. */
  signIn(): Promise<string>;
  /** The stored save (unvalidated) or null when none exists. */
  loadSave(uid: string): Promise<unknown>;
  writeSave(uid: string, data: unknown, savedAt: number): Promise<void>;
  /** Raw JSON text of the `economy_config` Remote Config parameter ('' when unset). */
  fetchRemoteConfig(): Promise<string>;
}

export class NoCloudBackend implements CloudBackend {
  readonly available = false;
  signIn(): Promise<string> { return Promise.reject(new Error('Cloud is not configured')); }
  loadSave(): Promise<unknown> { return Promise.resolve(null); }
  writeSave(): Promise<void> { return Promise.reject(new Error('Cloud is not configured')); }
  fetchRemoteConfig(): Promise<string> { return Promise.resolve(''); }
}

export const CLOUD_BACKEND = new InjectionToken<CloudBackend>('CloudBackend', {
  providedIn: 'root',
  factory: () => (FIREBASE_CONFIG ? new FirebaseBackend(FIREBASE_CONFIG) : new NoCloudBackend()),
});
