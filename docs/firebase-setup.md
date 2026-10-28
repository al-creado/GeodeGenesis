# Firebase setup (Stage 5)

The game runs fully offline until you add a Firebase web config. Cloud save and Remote Config switch on automatically once `src/app/firebase.config.ts` holds real values.

## 1. Create the project
1. Firebase console > Add project.
2. Project settings > Your apps > Add app > **Web** (`</>`). Copy the config object.
3. Paste it into `FIREBASE_CONFIG` in `src/app/firebase.config.ts` (apiKey, authDomain, projectId, appId). These values are not secrets; the rules below protect the data.

## 2. Anonymous sign-in
Build > Authentication > Sign-in method > enable **Anonymous**.

## 3. Firestore cloud save
Build > Firestore Database > Create database (production mode), then deploy the rules in `firestore.rules`:
```bash
npx firebase-tools deploy --only firestore:rules
```
Each save lives at `saves/{uid}` as `{ data, savedAt, updatedAt }`. Only that player's anonymous uid can read or write it.

## 4. Remote Config (economy numbers)
Build > Remote Config > add one parameter:

| Key | Type | Example |
|---|---|---|
| `economy_config` | JSON (string) | see below |

```json
{
  "economy": { "crackCost1": 100, "crackCost10": 900, "idleCoinsPerHour": 40, "idleCapHours": 8, "adMultiplier": 2, "postCrackBonus": 10, "dailyBonus": [20, 30, 40, 60, 80, 100, 150] },
  "baseOdds": { "quartz": 60, "amethyst": 28, "emerald": 9, "ruby": 2.5, "diamond": 0.5 },
  "luckPerGem": { "quartz": 0.002, "amethyst": 0.005, "emerald": 0.01, "ruby": 0.02, "diamond": 0.03 },
  "crew": { "luckCap": 0.15, "slotUnlockShards": [50, 150] },
  "pity": { "emeraldOrBetter": 10, "rubyOrBetter": 50 },
  "duplicates": { "shardsPerDuplicate": { "quartz": 1, "amethyst": 3, "emerald": 10, "ruby": 30, "diamond": 100 } }
}
```
Every group is optional and validated (see `src/app/core/remote-config.ts`): an invalid group is ignored and the rest applies. Odds must sum to 100. Ad unit ids, save version, level cap and slot counts can never be changed remotely.

Changes are fetched at app start (3 second limit, 1 hour minimum fetch interval). A late fetch is cached and applies on the next launch, so numbers never change mid-session. The Settings and Rates screen always shows the live values, so changed odds are disclosed automatically.

## How sync works
- On start: sign in anonymously, read the cloud save, and keep the **newest** (`savedAt`). A local game with no progress never overwrites a cloud save that has some.
- After that, changes upload 5 seconds after the last change and when the app goes to the background.
- A cloud save from a newer app version or one that can't be read is never overwritten.
- Anonymous accounts are tied to the install: uninstalling can lose access to the save (account linking is out of scope for v1).
- Devices with wrong clocks can confuse "newest wins".
