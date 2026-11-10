import { ART } from '../core/gem-art';
import { Rarity, Reward } from '../core/config';

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

/** Wait cut as a fraction: 0.02 -> "-2%". */
export function timerPct(cut: number): string {
  return `-${parseFloat((cut * 100).toFixed(2))}%`;
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

/** Solid capsule colors: the rarity tell shown on capsules. */
export const CAPSULE_COLOR: Readonly<Record<Rarity, string>> = {
  quartz: ART.frame.quartz,
  amethyst: ART.frame.amethyst,
  emerald: ART.frame.emerald,
  ruby: ART.frame.ruby,
  diamond: `linear-gradient(135deg, ${ART.frame.rainbow.join(', ')})`,
};

/** "100 coins", "5 shards", "a free x10 pull", "+0.5% luck", joined with "and". */
export function describeReward(r: Reward): string {
  const parts: string[] = [];
  if (r.coins) parts.push(`${r.coins} coins`);
  if (r.shards) parts.push(`${r.shards} shards`);
  if (r.tenTickets) parts.push(r.tenTickets === 1 ? 'a free x10 pull' : `${r.tenTickets} free x10 pulls`);
  if (r.luck) parts.push(`${luckPct(r.luck)} luck`);
  return parts.join(' and ') || 'nothing';
}

/** Short form for tight spots: "100", "5 sh", "x10". */
export function shortReward(r: Reward): string {
  if (r.coins) return String(r.coins);
  if (r.tenTickets) return 'x10';
  if (r.shards) return `${r.shards} sh`;
  if (r.luck) return luckPct(r.luck);
  return '-';
}
