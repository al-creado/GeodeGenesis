# Release checklist: Geode Genesis on Google Play

Status key: **[you]** needs your accounts or decisions, **[repo]** already done in this repo, **[verify]** done in code but must be checked on a real device.

## 0. What is already done in the repo
- [repo] Odds disclosure: Settings and Rates shows base odds, odds with your crew, luck rules, pity rules, duplicate/shard rules and "Ads are optional and never change your pull odds." Numbers come from the live config, so Remote Config changes are disclosed automatically.
- [repo] "Ads are optional and never change your pull odds." appears next to every ad button.
- [repo] No real-money purchases anywhere. Random pulls use only in-game coins earned by playing or watching optional ads.
- [repo] Launcher icons (adaptive + legacy + round), splash images, Play icon, feature graphic and 5 screenshots, generated from the game art: `npm run build && npm run assets` (see `tools/generate-store-assets.js`). Files are in `store/`.
- [repo] Release signing hook in `android/app/build.gradle` (reads `android/keystore.properties`, which is git-ignored). `versionCode 1`, `versionName 1.0.0`.
- [repo] Ad consent (Google UMP) for EEA/UK users, with an "Ad privacy options" button in Settings when required.
- [repo] Privacy policy draft: `docs/release/privacy-policy.html`.
- [repo] Draft answers: `data-safety.md`, `content-rating.md`, `store-listing.md`.

## 1. Accounts [you]
- [ ] Google Play Console developer account (one-time fee; identity verification).
- [ ] AdMob account, linked to the app once it exists in Play.
- [ ] Firebase project (see `docs/firebase-setup.md`).

## 2. Decisions only you can make [you]
- [ ] **Target audience.** The art is cute, so Play may treat the game as appealing to children. Recommended: declare **13 and older**, which keeps the game out of the stricter Families program. If you instead target under-13s, ads and data collection must follow the Families policy (certified ad SDKs, no personalized ads) and this plan changes. Decide before filling in the Play Console target audience page.
- [ ] Developer name and a public support email (used in the policy and listing).
- [ ] Where to host the privacy policy (a public, non-PDF URL). Easiest: turn on GitHub Pages for this repo's `/docs` folder, then the policy is at `https://<user>.github.io/<repo>/release/privacy-policy.html`.

## 3. Replace test values with real ones [you, then verify]
1. [ ] **AdMob:** create the Android app in AdMob, then a **Rewarded** ad unit.
   - `android/app/src/main/res/values/strings.xml`: set `admob_app_id` to the real app id (`ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN`).
   - `src/app/core/config.ts` `ads.admob`: set `appId`, `rewardedUnitId` (real, `.../NNNNNNNNNN`) and `useTestAds: false`.
   - A unit test (`admob-ad.service.spec.ts`) fails if test ids and `useTestAds` disagree, so you can't half-switch.
   - Never click your own live ads. Add your phone as an AdMob test device while testing.
2. [ ] **Firebase:** paste the web config into `src/app/firebase.config.ts`, enable Anonymous auth, deploy `firestore.rules`, add the `economy_config` Remote Config parameter. Restrict the web API key to your app in Google Cloud Console (APIs and services > Credentials).
3. [ ] **Privacy policy URL:** fill the placeholders in `privacy-policy.html`, host it, then set `legal.privacyPolicyUrl` and `legal.supportEmail` in `src/app/core/config.ts` (Settings then shows the link) and enter the same URL in Play Console.
4. [ ] Bump `versionCode` (must increase on every upload) and `versionName` in `android/app/build.gradle`, and `version` in `package.json`.

## 4. Signing and building the bundle [you]
Create an **upload key** once (keep it and its passwords safe; back them up somewhere private; never commit them):
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore geode-genesis-upload.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Create `android/keystore.properties` (git-ignored):
```properties
storeFile=/absolute/path/to/geode-genesis-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```
Build (needs JDK 21 and the Android SDK):
```bash
npm run android:bundle
# output: android/app/build/outputs/bundle/release/app-release.aab
```
Enroll in **Play App Signing** when you create the app in Play Console (default for new apps): Google holds the app signing key, and your upload key can be reset if you lose it.

## 5. Play Console setup [you]
- [ ] Create the app (name "Geode Genesis", Game, Free).
- [ ] Store listing: use `store-listing.md`; upload `store/play-icon-512.png`, `store/feature-graphic-1024x500.png`, and the screenshots in `store/screenshots/`.
- [ ] Privacy policy URL.
- [ ] App content: ads declaration (**Contains ads: yes**), target audience (see section 2), data safety (`data-safety.md`), content rating questionnaire (`content-rating.md`), advertising ID declaration (**used for advertising**), and the other declarations (news, government, health, financial: all no).
- [ ] Link AdMob to the Play listing once it is published or in testing.

## 6. Internal testing track [you]
1. Play Console > Testing > **Internal testing** > Create new release.
2. Upload `app-release.aab`, add release notes, save and roll out.
3. Testers tab: create an email list (up to 100 testers) and share the opt-in link.
4. Note: personal developer accounts created recently may need a **closed test with a minimum number of testers for 14 days** before production access. Check the current rule in Play Console's "Production access" page.

## 7. Device test pass [verify]
Run through this on a real phone with the release build (test ads on until the end):
- [ ] Fresh install: starts on Camp, 300 coins, no crash, back button leaves the app.
- [ ] Mine x1 and x10: coins, pity bars, NEW! tag, level-ups and shards behave.
- [ ] Watch an ad to the end: coins x2 only after the ad finishes. Close an ad early: no reward.
- [ ] Airplane mode: game starts and plays; ads simply fail with no reward and no freeze.
- [ ] EEA/UK test (AdMob debug geography or a VPN device): the consent form appears; "Ad privacy options" shows in Settings.
- [ ] Cloud save: play, install on a second device, confirm progress arrives; confirm a fresh install does not wipe an existing cloud save.
- [ ] Remote Config: change a value, relaunch twice (first launch caches, second applies), check Settings and Rates shows it.
- [ ] Settings > Reset progress works; privacy policy link opens.
- [ ] Rotate and background/foreground: idle coins still correct.
- [ ] Switch `useTestAds` to false only for the final build, and confirm real ads load (as the owner, do not click them).

## 8. After the internal test
Promote to closed/open testing or production when the checks pass. Keep the upload key, keystore passwords and Firebase/AdMob access safe.

## Known limits
- Anonymous cloud accounts are tied to the install; uninstalling can lose access to the cloud save.
- Account/data deletion is by email request (see policy). If you want an in-app "delete my cloud data" button, that is a small follow-up.
- The Android build and the Firebase/AdMob calls have not been run in the authoring environment (no Android SDK or Firebase project available there). Treat section 7 as required, not optional.
