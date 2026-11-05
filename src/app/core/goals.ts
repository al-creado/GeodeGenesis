import { GAME_CONFIG, GameConfig, GoalDef, Rarity, Reward } from './config';
import { isAtLeast } from './odds';

/** Progress toward the daily and weekly goals. Resets when the day or week changes. */
export interface GoalState {
  readonly day: number;
  readonly week: number;
  readonly dailyPulls: number;
  readonly dailyRare: number;
  readonly weeklyPulls: number;
  /** Ids of goals already claimed this period. */
  readonly claimed: readonly string[];
}

export const INITIAL_GOALS: GoalState = { day: -1, week: -1, dailyPulls: 0, dailyRare: 0, weeklyPulls: 0, claimed: [] };

export interface GoalView {
  readonly def: GoalDef;
  readonly period: 'daily' | 'weekly';
  readonly progress: number;
  readonly done: boolean;
  readonly claimed: boolean;
}

/** Reset whatever period has rolled over. Safe to call as often as you like. */
export function rollGoals(state: GoalState, day: number, week: number, config: GameConfig = GAME_CONFIG): GoalState {
  let next = state;
  const dailyIds = new Set(config.goals.daily.map((g) => g.id));
  const weeklyIds = new Set(config.goals.weekly.map((g) => g.id));
  if (state.day !== day) {
    next = { ...next, day, dailyPulls: 0, dailyRare: 0, claimed: next.claimed.filter((id) => !dailyIds.has(id)) };
  }
  if (state.week !== week) {
    next = { ...next, week, weeklyPulls: 0, claimed: next.claimed.filter((id) => !weeklyIds.has(id)) };
  }
  return next;
}

/** Count a batch of pulls toward the goals. */
export function recordPulls(
  state: GoalState,
  rarities: readonly Rarity[],
  config: GameConfig = GAME_CONFIG,
): GoalState {
  const rare = rarities.filter((r) => isAtLeast(r, config.goals.rareFrom)).length;
  return {
    ...state,
    dailyPulls: state.dailyPulls + rarities.length,
    dailyRare: state.dailyRare + rare,
    weeklyPulls: state.weeklyPulls + rarities.length,
  };
}

function progressOf(state: GoalState, def: GoalDef, period: 'daily' | 'weekly'): number {
  if (def.metric === 'rareFinds') return state.dailyRare;
  return period === 'daily' ? state.dailyPulls : state.weeklyPulls;
}

export function goalViews(state: GoalState, config: GameConfig = GAME_CONFIG): GoalView[] {
  const make = (def: GoalDef, period: 'daily' | 'weekly'): GoalView => {
    const progress = Math.min(progressOf(state, def, period), def.target);
    return { def, period, progress, done: progress >= def.target, claimed: state.claimed.includes(def.id) };
  };
  return [...config.goals.daily.map((d) => make(d, 'daily')), ...config.goals.weekly.map((d) => make(d, 'weekly'))];
}

/** Claim a finished goal. Returns null if it is unknown, unfinished or already claimed. */
export function claimGoal(
  state: GoalState,
  id: string,
  config: GameConfig = GAME_CONFIG,
): { state: GoalState; reward: Reward } | null {
  const view = goalViews(state, config).find((v) => v.def.id === id);
  if (!view || !view.done || view.claimed) return null;
  return { state: { ...state, claimed: [...state.claimed, id] }, reward: view.def.reward };
}
