import { GAME_CONFIG, GameConfig, Rarity } from './config';
import { computeLuck } from './odds';
import { CrewMember, gemLuck } from './progression';

/** What a gem does passively while it sits in the crew. All values are exact (nothing is rolled). */
export interface Passives {
  /** Luck as a fraction (0.005 = +0.5%). */
  readonly luck: number;
  /** Cut to the free-pull wait as a fraction (0.02 = 2% shorter). */
  readonly timerReduction: number;
}

/** A gem's passives at a level. The timer cut grows with level the same way luck does. */
export function gemPassives(rarity: Rarity, level: number, config: GameConfig = GAME_CONFIG): Passives {
  const growth = 1 + config.progression.levelLuckFactor * (Math.max(level, 1) - 1);
  return { luck: gemLuck(rarity, level, config), timerReduction: config.timerReductionPerGem[rarity] * growth };
}

/** The crew's total free-pull wait cut, capped. */
export function crewTimerReduction(crew: readonly CrewMember[], config: GameConfig = GAME_CONFIG): number {
  const sum = crew.reduce((a, m) => a + gemPassives(m.rarity, m.level, config).timerReduction, 0);
  return Math.min(sum, config.freePull.maxReduction);
}

export interface CrewTotals {
  /** Total luck, capped. */
  readonly luck: number;
  /** Total free-pull wait cut, capped. */
  readonly timerReduction: number;
}

export function crewTotals(crew: readonly CrewMember[], permanentLuck: number, config: GameConfig = GAME_CONFIG): CrewTotals {
  return { luck: computeLuck(crew, config, permanentLuck), timerReduction: crewTimerReduction(crew, config) };
}

export interface CrewPreview {
  readonly before: CrewTotals;
  readonly after: CrewTotals;
}

/** Totals before and after adding a gem to the crew, or removing one that is in it. */
export function previewCrewChange(
  crew: readonly CrewMember[],
  permanentLuck: number,
  change: { add: CrewMember } | { removeId: string },
  config: GameConfig = GAME_CONFIG,
): CrewPreview {
  const before = crewTotals(crew, permanentLuck, config);
  const next = 'add' in change ? [...crew, change.add] : crew.filter((m) => m.id !== change.removeId);
  return { before, after: crewTotals(next, permanentLuck, config) };
}
