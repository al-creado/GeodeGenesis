import { SaveData } from './save';

export type SyncDecision = 'upload' | 'download' | 'same';

/** True if the save holds real progress: gems found or geodes cracked. */
export function hasProgress(save: SaveData): boolean {
  return save.totalCracks > 0 || Object.keys(save.collection).length > 0;
}

/**
 * Decide what to do when a local and a cloud save exist. The newest save wins.
 * A local game with no progress (nothing mined yet) never beats a cloud save that has some,
 * so a fresh install can't wipe a player's cloud save by tapping a button before sync finishes.
 */
export function chooseSave(local: SaveData, cloud: SaveData | null): SyncDecision {
  if (!cloud) return local.savedAt > 0 ? 'upload' : 'same';
  if (!hasProgress(local) && hasProgress(cloud) && cloud.savedAt !== local.savedAt) return 'download';
  if (cloud.savedAt > local.savedAt) return 'download';
  if (cloud.savedAt < local.savedAt) return 'upload';
  return 'same';
}
