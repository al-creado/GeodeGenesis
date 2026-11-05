# Geode Genesis

A cozy mobile gacha sim for Android. Earn coins, crack geodes, collect cute gem characters, and build a Lucky Crew that slightly improves your luck. Rewarded ads multiply coin rewards. **Ads never change pull odds.**

Tech: Angular (standalone components, signals, strict TypeScript) + Capacitor (Android). Ads via `@capacitor-community/admob` (Google TEST ad unit IDs only). Persistence: localStorage behind a `SaveService` interface; Firebase (anonymous auth, Firestore, Remote Config) in Stage 5.

## Core loop
A pure gacha loop: pull the lever of the gold gem machine, collect gem characters of five rarities, and level them with duplicates. Coins come from the login calendar, daily and weekly goals, collection rewards and optional rewarded ads (x2 on the calendar coins and the post-pull bonus). Luck from the Lucky Crew, completed sets and collection rewards slightly improves odds. The first pull is free, and so is one pull a day.

## Currency
- **Coins**: main currency (never called "gems").
- **Shards**: earned when a duplicate drops at max level.
- Pull x1 = 100 coins, x10 = 900 coins. There is no idle income: coins and free x10 tickets come from the daily rhythm.
- Login calendar (forgiving, never resets): 100/100/150/150/200/250 coins, then a free x10 ticket on day 7. Daily goals (pull 10 times, find an Amethyst or better) and a weekly goal (pull 70 times) pay coins, shards and a free x10 ticket.

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

**Duplicates:** level the gem up to 10; after that, a duplicate converts to shards. **Shards** unlock Crew slots 4 and 5 (50 and 150 shards).

## Ads
`AdService` interface with Simulated (3-second fake dialog for the browser), AdMob (test IDs), and NoAds implementations. The multiplier is granted only after the reward callback fires. "Ads are optional and never change your pull odds" is shown wherever ads are offered. A Settings and Rates screen shows full odds and pity rules (required by Google Play).

## Art (no image assets)
Gems are SVG generated in code by a `GemArt` component seeded by gem id. Shapes: point, kite, step, heart, brilliant cut; each has a cute face. Outline #24160F, stroke 2.5. Palette: Rose #F4C2D7, Citrine #FFD36B, Amethyst #B58CFF, Sapphire #6FA8FF, Emerald #3FC28F, Ruby #FF6B8A; Diamond uses a white/pastel iridescent gradient. Rarity frames: Quartz plain gray #C9C3D8, Amethyst purple with twinkles, Emerald green glow, Ruby warm shimmer, Diamond rainbow gradient border.

## Style: video-game cave
Background #2A1C14, cards #3E2A1E with #5C402D borders, nav bar #1E130D, stalactites #1C120C along the top of every screen. Text #F6E7D0, muted #CDB397. Primary buttons gold #F2B84B (dark text #24160F), ad buttons amber #E8833A (dark text). Font Nunito 700/800.

## Screens (bottom tabs)
New players see only **Mine**; the other tabs unlock as they play (Vault and Daily after the first pull, Crew after the first Emerald or better, the Shop and pity bars after 10 pulls). Locked tabs explain how to unlock them.
1. **Daily**: free daily pull, forgiving login calendar (Watch ad for x2 coins), daily and weekly goals.
2. **Mine**: the gold lottery machine in the cave (pull its lever, or use Mine x1 / x10 / a free x10 ticket). The first pull is free. Odds list, total-luck chip, pity bars and the rates link. The result screen pulls the lever, drops a capsule colored by rarity and pops it open; ten-pulls show ten capsules to tap open or open all.
3. **Vault**: collection rewards (6/12/18/24 gems), set bonuses, rarity filters, 3-column grid with "?" cells. Tap a gem for its profile: story, level, crew luck. Links to the **Shop**: a spark every 150 pulls (choose any gem) and shards for buying gems you have not found.
4. **Crew**: slots, total luck with its sources (crew, sets, collection rewards), before/after Ruby odds, tap-to-add owned gems.
Plus Settings/Rates sub-screen.

## Layout
```
src/app/core/      pure TypeScript game logic (no Angular imports) + unit tests
src/app/services/  GameStateService, PullService, AdService, SaveService
src/app/screens/   Daily, Mine, Vault (+ Shop), Crew, Settings/Rates
src/app/ui/        shared components (GemArt, frames, stalactites)
```
All numbers live in `src/app/core/config.ts`. See `CLAUDE.md` for the architecture rules.

## Out of scope for v1
Battles, PvP, story, hand-drawn art, real-money purchases, rate-up banners, seasonal events.

## Stages
1. Scaffold, folder structure, pull-logic module with unit tests (**done**)
2. GemArt SVG generator and preview page (**done**)
3. Four playable tabs, simulated ads, localStorage saves (**done**)
4. Capacitor Android build and AdMob rewarded ads (test IDs) (**done**, APK build not yet verified: see Android below)
5. Firebase anonymous auth, Firestore cloud save, Remote Config (**done**, needs a real Firebase project: see `docs/firebase-setup.md`)
6. Google Play release checklist (**done**: see `docs/release/release-checklist.md`; needs your accounts, real ids and a device test)

## Android
The `android/` project is generated by Capacitor 8 (min SDK 24, compile/target SDK 36, needs JDK 21 and the Android SDK).
```bash
npm run android:sync     # ng build + cap sync android
npm run android:open     # open in Android Studio
npm run android:debug    # build a debug APK: android/app/build/outputs/apk/debug
```
Ads: in the browser the Simulated dialog is used; in the Android app `AdMobAdService` is used with **Google test ids only** (see `GAME_CONFIG.ads.admob` and `strings.xml`). Real ids are a Stage 6 task.

## Economy playtest
`npm run sim` simulates players (occasional, casual, daily) and prints the median day each collection milestone is reached. Try new numbers before setting them in Remote Config: `npm run sim -- '{"shop":{"sparkAt":200}}'`.

## Development
Requires Node >= 22.22.3 or 24 (Angular CLI requirement).
```bash
npm install
npm start                    # dev server
npm test -- --watch=false    # unit tests (Vitest)
npm run build
```
