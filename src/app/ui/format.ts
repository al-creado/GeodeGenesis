import { ART } from '../core/gem-art';
import { Rarity } from '../core/config';

export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  quartz: 'Quartz',
  amethyst: 'Amethyst',
  emerald: 'Emerald',
  ruby: 'Ruby',
  diamond: 'Diamond',
};

/** CSS background used for rarity bars, chips and borders. */
export const RARITY_COLOR: Readonly<Record<Rarity, string>> = {
  quartz: ART.frame.quartz,
  amethyst: ART.frame.amethyst,
  emerald: ART.frame.emerald,
  ruby: `linear-gradient(90deg, ${ART.frame.ruby}, ${ART.frame.rubyWarm})`,
  diamond: `linear-gradient(90deg, ${ART.frame.rainbow.join(', ')})`,
};

/** Odds in percent with two decimals: 2.5 -> "2.50%". */
export function pct(percent: number, digits = 2): string {
  return `${percent.toFixed(digits)}%`;
}

/** Luck fraction as a signed percent: 0.035 -> "+3.5%". */
export function luckPct(luck: number): string {
  return `+${parseFloat((luck * 100).toFixed(2))}%`;
}

/** "3h 12m" / "45m" / "20s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSeconds}s`;
}
