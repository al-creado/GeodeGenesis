# Play Console: Data safety form (draft answers)

This matches the app as built (Firebase Auth anonymous, Firestore, Remote Config, AdMob). **Re-check each answer against Google's current guidance before submitting**, especially AdMob's: https://support.google.com/admob/answer/6128543 and Firebase's: https://firebase.google.com/docs/android/play-data-disclosure. Your answers must match the privacy policy.

## Overview questions
| Question | Answer |
|---|---|
| Does the app collect or share any of the required user data types? | Yes |
| Is all collected data encrypted in transit? | Yes |
| Do you provide a way for users to request data deletion? | Yes, by email request (see privacy policy). Provide the policy URL; no in-app deletion yet. |
| Does the app let users create an account? | No (anonymous sign-in is automatic and invisible) |

## Data types
| Category > type | Collected | Shared | Purpose | Optional? | Notes |
|---|---|---|---|---|---|
| App activity > Other user-generated content (game progress in the cloud save) | Yes | No | App functionality | No (cloud save is automatic when enabled) | Stored in Firestore under the anonymous ID |
| Device or other IDs > Device or other IDs | Yes | Yes (with Google AdMob) | Advertising or marketing; App functionality (Firebase installation ID, anonymous user ID); Analytics/fraud prevention | Ads are optional | Advertising ID, Firebase installation ID, anonymous auth uid |
| App activity > App interactions | Yes | Yes (AdMob) | Advertising or marketing; Analytics | Ads are optional | Ad impressions and ad interactions |
| App info and performance > Diagnostics | Yes | Yes (AdMob/Firebase) | Analytics; Fraud prevention, security | No | SDK diagnostics |
| Location > Approximate location | Yes | Yes (AdMob) | Advertising or marketing | No | Derived from IP address by Google |

Not collected: name, email, address, phone, precise location, contacts, photos, files, health, financial info, messages, web history, audio, calendar.

## Other Play Console declarations tied to this
- **Advertising ID:** the app uses it. Declare the purpose as **Advertising or marketing** (AdMob). The AdMob SDK adds the `com.google.android.gms.permission.AD_ID` permission automatically.
- **Ads:** "Contains ads" = Yes.
- **Target audience:** see `release-checklist.md` section 2 (recommended 13+).
- Data collected by SDKs counts as collected by the app, so keep this table in step with the SDKs you ship. If you add analytics, crash reporting or account linking later, update it.
