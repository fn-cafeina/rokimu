# Rokimu

Android anime streaming client built with Expo SDK 57.

## Requirements

- Node.js LTS
- npm
- JDK 17 and the Android SDK for local builds

## Setup

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

Rokimu needs a development build. It does not run in Expo Go: the installer
config plugin and the `REQUEST_INSTALL_PACKAGES` permission are applied at
prebuild time.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript 6 (strict)
- Tailwind CSS v4 through [NativeWind](https://www.nativewind.dev/) v5
- expo-router, Zustand 5, expo-video, Reanimated 4

## Development

| Command | What it does |
|---|---|
| `npm run android` | Build and run on a device or emulator |
| `npm start` | Dev server |
| `npx tsc --noEmit` | Typecheck |
| `npm run lint` | ESLint via `expo lint` |

`@/*` resolves to `src/*`.

## Releases

Versions are bumped by hand, in `package.json` (`version`) and `app.json`
(`expo.version` plus `expo.android.versionCode`). The workflow fails if the two
versions disagree.

Releases are built on GitHub Actions with a manual run of the `Build & Release`
workflow. It lints, typechecks, builds a signed APK with `eas build --local`,
and opens a draft GitHub Release with the APK attached and notes taken from the
last ten commits. Publish the draft to make it visible, since the in-app update
check reads `releases/latest`.

The build runs on the GitHub runner and uses no EAS build minutes. The Android
keystore lives in EAS, so the only secret the workflow needs is `EXPO_TOKEN`.

## Structure

- `app/`: screens, file-based routing through `expo-router`
- `src/components/`: UI shared between screens
- `src/hooks/`: screen and data hooks
- `src/stores/`: Zustand stores
- `src/services/`: HTTP client, HTML parsers, session handling, updater
- `src/config/`: source URLs, cache prefixes and TTLs
- `src/utils/`: cache, storage, logger, navigation
- `plugins/`: Expo config plugins

## Legal

Rokimu is an independent third-party client. It is not affiliated with,
endorsed by, or sponsored by any service or content provider it may access.

The app does not host, store, or distribute anime content. All content
belongs to its respective authors and rightsholders.

Users are responsible for the content they access through the app.

## License

MIT. See [LICENSE](LICENSE).
