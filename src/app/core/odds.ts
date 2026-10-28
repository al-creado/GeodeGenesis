import { GAME_CONFIG, GameConfig, RARITIES, Rarity } from './config';

export type OddsTable = Record<Rarity, number>;

/** Index of a rarity in ascending order (quartz = 0). */
export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

export function isAtLeast(rarity: Rarity, min: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank(min);
}

/** Total crew luck as a fraction, summed per gem and capped. */
export function computeLuck(crew: readonly Rarity[], config: GameConfig = GAME_CONFIG): number {
  const sum = crew.reduce((acc, r) => acc + config.luckPerGem[r], 0);
  return Math.min(sum, config.crew.luckCap);
}

/**
 * Odds in percent (summing to 100) for a given luck fraction.
 * Every non-Quartz weight is multiplied by (1 + luck), then all weights are
 * renormalized.
 */
export function adjustedOdds(luck: number, config: GameConfig = GAME_CONFIG): OddsTable {
  const weights = {} as OddsTable;
  let total = 0;
  for (const r of RARITIES) {
    const w = r === 'quartz' ? config.baseOdds[r] : config.baseOdds[r] * (1 + luck);
    weights[r] = w;
    total += w;
  }
  const odds = {} as OddsTable;
  for (const r of RARITIES) odds[r] = (weights[r] / total) * 100;
  return odds;
}
