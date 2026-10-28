import type { FirebaseApp } from 'firebase/app';
import type { FirebaseWebConfig } from '../firebase.config';
import type { CloudBackend } from './cloud-backend';

/** Remote Config parameter holding the JSON economy overrides. */
export const REMOTE_CONFIG_KEY = 'economy_config';
/** Firestore collection holding one save document per player uid. */
export const SAVES_COLLECTION = 'saves';

/**
 * Firebase JS SDK backend: anonymous Auth, Firestore cloud save, Remote Config.
 * The SDK is loaded lazily so local-only users never download it.
 */
export class FirebaseBackend implements CloudBackend {
  readonly available = true;
  private app: Promise<FirebaseApp> | null = null;

  constructor(private readonly options: FirebaseWebConfig) {}

  async signIn(): Promise<string> {
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const auth = getAuth(await this.getApp());
    await auth.authStateReady(); // restores the previous anonymous user if there is one
    if (auth.currentUser) return auth.currentUser.uid;
    return (await signInAnonymously(auth)).user.uid;
  }

  async loadSave(uid: string): Promise<unknown> {
    const fs = await import('firebase/firestore');
    const snap = await fs.getDoc(fs.doc(fs.getFirestore(await this.getApp()), SAVES_COLLECTION, uid));
    return snap.exists() ? (snap.data()['data'] ?? null) : null;
  }

  async writeSave(uid: string, data: unknown, savedAt: number): Promise<void> {
    const fs = await import('firebase/firestore');
    const ref = fs.doc(fs.getFirestore(await this.getApp()), SAVES_COLLECTION, uid);
    await fs.setDoc(ref, { data, savedAt, updatedAt: fs.serverTimestamp() });
  }

  async fetchRemoteConfig(): Promise<string> {
    const rc = await import('firebase/remote-config');
    const config = rc.getRemoteConfig(await this.getApp());
    config.settings.minimumFetchIntervalMillis = 3_600_000; // 1 hour
    config.defaultConfig = { [REMOTE_CONFIG_KEY]: '' };
    await rc.fetchAndActivate(config);
    return rc.getString(config, REMOTE_CONFIG_KEY);
  }

  private getApp(): Promise<FirebaseApp> {
    this.app ??= import('firebase/app').then((m) => m.initializeApp({ ...this.options }));
    return this.app;
  }
}
