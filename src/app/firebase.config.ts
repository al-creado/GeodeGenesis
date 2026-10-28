/**
 * Firebase web-app config. Leave as `null` to run fully offline (no cloud save,
 * no Remote Config). To enable, paste the values from
 * Firebase console > Project settings > Your apps > Web app > SDK setup and configuration.
 * These values identify the project and are not secrets; Firestore rules protect the data.
 */
export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  readonly messagingSenderId?: string;
  readonly storageBucket?: string;
}

export const FIREBASE_CONFIG: FirebaseWebConfig | null = null;
