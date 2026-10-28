# Geode Genesis

A cozy mobile gacha sim for Android. Earn coins, crack geodes, collect cute gem characters, and build a Lucky Crew that slightly improves your luck. Rewarded ads multiply coin rewards. **Ads never change pull odds.**

Tech: Angular (standalone components, signals, strict TypeScript) + Capacitor (Android). Ads via `@capacitor-community/admob` (Google TEST ad unit IDs only). Persistence: localStorage behind a `SaveService` interface; Firebase (anonymous auth, Firestore, Remote Config) in Stage 5.

## Core loop
Coins come from idle income, a daily bonus, and optional rewarded ads. Coins buy geode cracks, which give gem characters of different rarities. Gems in the Lucky Crew add small luck. Ads give x2 on the daily bonus, idle collection, and a post-crack coin bonus.

## Currency
- **Coins**: main currency (never called "gems").
- **Shards**: earned when a duplicate drops at max level.
- Crack x1 = 100 coins, x10 = 900 coins. Idle coins accrue while away, capped at 8 hours.
- 7-day daily bonus (day 4 = 60 coins).

## Rarity
| Rarity | Odds | Luck per crew gem | Gems |
|---|---|---|---|
| Quartz | 60% | +0.2% | 8 |
| Amethyst | 28% | +0.5% | 7 |
| Emerald | 9% | +1% | 5 |
| Ruby | 2.5% | +2% | 3 |
| Diamond | 0.5% | +3% | 1 |

**Lucky Crew:** 3 to 5 slots (start with 3). Total luck = sum, capped at +15%. Luck multiplies every non-Quartz weight by (1 + luck), then all weights are renormalized to 100%. (+3.5% luck gives Quartz 59.17, Amethyst 28.58, Emerald 9.19, Ruby 2.55, Diamond 0.51.)

**Pity:** Emerald+ guaranteed at 10 cracks, Ruby+ at 50. Counters reset when that tier or better drops.

**Duplicates:** level the gem up to 10; after that, a duplicate converts to shards.

## Ads
`AdService` interface with Simulated (3-second fake dialog for the browser), AdMob (test IDs), and NoAds implementations. The multiplier is granted only after the reward callback fires. "Ads are optional and never change your pull odds" is shown wherever ads are offered. A Settings and Rates screen shows full odds and pity rules (required by Google Play).

## Art (no image assets)
Gems are SVG generated in code by a `GemArt` component seeded by gem id. Shapes: point, kite, step, heart, brilliant cut; each has a cute face. Outline #24160F, stroke 2.5. Palette: Rose #F4C2D7, Citrine #FFD36B, Amethyst #B58CFF, Sapphire #6FA8FF, Emerald #3FC28F, Ruby #FF6B8A; Diamond uses a white/pastel iridescent gradient. Rarity frames: Quartz plain gray #C9C3D8, Amethyst purple with twinkles, Emerald green glow, Ruby warm shimmer, Diamond rainbow gradient border.

## Style: video-game cave
Background #2A1C14, cards #3E2A1E with #5C402D borders, nav bar #1E130D, stalactites #1C120C along the top of every screen. Text #F6E7D0, muted #CDB397. Primary buttons gold #F2B84B (dark text #24160F), ad buttons amber #E8833A (dark text). Font Nunito 700/800.

## Screens (bottom tabs)
1. **Camp**: idle counter with Pebble mascot, Collect / Watch ad to collect x2, 7-day daily bonus row.
2. **Mine**: geode banner, Mine x1 / x10, odds list, crew luck chip, pity bars, rates link, reveal result screen.
3. **Vault**: rarity filter chips, 3-column grid, locked "?" cells, count like 7/24.
4. **Crew**: slots, luck meter with cap, before/after Ruby odds, tap-to-add owned gems.
Plus Settings/Rates sub-screen.

## Layout
```
src/app/core/      pure TypeScript game logic (no Angular imports) + unit tests
src/app/services/  GameStateService, PullService, AdService, SaveService
src/app/screens/   Camp, Mine, Vault, Crew, Settings/Rates
src/app/ui/        shared components (GemArt, frames, stalactites)
```
All numbers live in `src/app/core/config.ts`. See `CLAUDE.md` for the architecture rules.

## Out of scope for v1
Battles, PvP, story, hand-drawn art, real-money purchases, rate-up banners, seasonal events.

## Stages
1. Scaffold, folder structure, pull-logic module with unit tests (**done**)
2. GemArt SVG generator and preview page
3. Four playable tabs, simulated ads, localStorage saves
4. Capacitor Android build and AdMob rewarded ads (test IDs)
5. Firebase anonymous auth, Firestore cloud save, Remote Config
6. Google Play release checklist

## Development
Requires Node >= 22.22.3 or 24 (Angular CLI requirement).
```bash
npm install
npm start                    # dev server
npm test -- --watch=false    # unit tests (Vitest)
npm run build
```
