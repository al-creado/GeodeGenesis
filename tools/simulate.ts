/** Economy playtest: `npm run sim`. Prints how long different players take to build a collection. */
import { GAME_CONFIG } from '../src/app/core/config';
import { parseRemoteConfigJson } from '../src/app/core/remote-config';
import { medianDay, PROFILES, simulatePlayer } from '../src/app/core/simulate';
import { ROSTER } from '../src/app/core/roster';

// Optional: pass a Remote Config JSON (same format as the economy_config parameter) to try it out.
//   npm run sim -- '{"economy":{"idleCoinsPerHour":15}}'
const override = parseRemoteConfigJson(process.argv[2], GAME_CONFIG);
if (process.argv[2] && override.rejected.length) console.log(`Ignored invalid groups: ${override.rejected.join(', ')}`);
const CONFIG = override.config;

const DAYS = 365;
const RUNS = 200;
const total = ROSTER.length;
const milestones = [6, 12, 18, 22, total];

const fmt = (d: number | null): string => (d === null ? `>${DAYS}` : String(d)).padStart(5);

console.log(`Economy simulation: ${RUNS} players per profile, up to ${DAYS} days (median day each milestone is reached)\n`);
console.log(`Idle ${CONFIG.economy.idleCoinsPerHour}/h (cap ${CONFIG.economy.idleCapHours}h), crack ${CONFIG.economy.crackCost1}/${CONFIG.economy.crackCost10}, daily ${CONFIG.economy.dailyBonus.join('/')}, ad x${CONFIG.economy.adMultiplier}\n`);
console.log('Profile'.padEnd(34) + milestones.map((m) => `${m}/${total}`.padStart(8)).join('') + '  Ruby  Diamond  cracks/day');
for (const p of PROFILES) {
  const runs = Array.from({ length: RUNS }, (_, i) => simulatePlayer(p, DAYS, i + 1, CONFIG));
  const cols = milestones.map((m) => fmt(medianDay(runs.map((r) => r.dayOwned[m]))).padStart(8)).join('');
  const ruby = fmt(medianDay(runs.map((r) => r.dayFirst['ruby'])));
  const diamond = fmt(medianDay(runs.map((r) => r.dayFirst['diamond'])));
  const perDay = (runs.reduce((a, r) => a + r.totalCracks, 0) / RUNS / DAYS).toFixed(1);
  console.log(p.name.padEnd(34) + cols + `  ${ruby}  ${diamond.padStart(7)}  ${perDay.padStart(10)}`);
}
