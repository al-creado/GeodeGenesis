import { GAME_CONFIG, GameConfig } from './config';
import { Collection, applyDuplicate, DuplicateOutcome } from './pull';
import { GemDef } from './roster';

export function sparkReady(progress: number, config: GameConfig = GAME_CONFIG): boolean {
  return progress >= config.shop.sparkAt;
}

/** Spend a spark to choose any gem. Progress above the threshold carries over. Pity is untouched. */
export function claimSpark(
  collection: Collection,
  progress: number,
  gem: GemDef,
  config: GameConfig = GAME_CONFIG,
): { collection: Collection; progress: number; outcome: DuplicateOutcome; level: number; shardsGained: number } | null {
  if (!sparkReady(progress, config)) return null;
  const applied = applyDuplicate(collection, gem, config);
  return { ...applied, progress: progress - config.shop.sparkAt };
}

export function exchangeCost(gem: GemDef, config: GameConfig = GAME_CONFIG): number {
  return config.shop.exchangeShards[gem.rarity];
}

/** Buy a gem you have not found yet with shards. Returns null if you own it or cannot afford it. */
export function exchangeGem(
  collection: Collection,
  shards: number,
  gem: GemDef,
  config: GameConfig = GAME_CONFIG,
): { collection: Collection; shards: number } | null {
  const cost = exchangeCost(gem, config);
  if (collection[gem.id] || shards < cost) return null;
  return { collection: { ...collection, [gem.id]: { level: 1 } }, shards: shards - cost };
}
