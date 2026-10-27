# DeepRest Mobile (Android)

Companion app that reads **REAL screen time** from your phone (per-app
foreground minutes via Android's UsageStatsManager) and syncs it to your
DeepRest account — the same account, rank, streak and AI companions as
the website at https://deeprest-app.dev078.workers.dev.

## What it does

- Sign in with the same **name + password** as the website (no email)
- One-time **Usage Access** permission (Android requires manual granting)
- **Sync real screen time**: total minutes + top-5 apps pushed to your dashboard
- Hourly **background sync** (best effort — Android limits background work)
- Live rank / XP / streak / target progress, pull-to-refresh

## Prerequisites

- Node 18+ and npm
- One of:
  - **Android Studio** (emulator or USB-debugging phone), or
  - a free **Expo account** for cloud APK builds (no Android Studio needed)

## Option A — build on your computer (needs Android Studio)

```bash
cd mobile
npm install
npx expo install --fix      # aligns dependency versions with the SDK
npx expo run:android        # phone connected via USB debugging, or emulator
```

## Option B — cloud APK (no Android Studio)

```bash
cd mobile
npm install
npx expo install --fix
npm i -g eas-cli
eas login                   # free Expo account
eas build -p android --profile preview
```

When the build finishes, EAS prints a link — open it on your phone and
install the APK (allow "install unknown apps" when asked).

## First run

1. Sign in (or create an account) with name + password.
2. Tap **Enable Usage Access** → find **DeepRest** in the list → toggle ON → back.
3. Tap **Sync real screen time now** — your dashboard on the website
   updates instantly with today's real numbers.

## Notes

- Android does not expose per-URL browsing history to any app — per-app
  minutes (TikTok, YouTube, Chrome, …) is exactly what the platform allows
  and what DeepRest tracks.
- The token is stored in the phone's hardware-backed keystore
  (`expo-secure-store`), never in plain text.
- API base URL lives in `src/api.ts` (`API_BASE`) and `app.json` (`extra.apiBase`).
