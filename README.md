# Rokimu

Android anime streaming client built with Expo SDK 58.

## Requirements

- Node.js LTS
- bun
- JDK 17 and the Android SDK for local builds

## Setup

```bash
bun install
bunx expo prebuild --platform android
bun run android
```

Rokimu needs a development build. It does not run in Expo Go: the installer
config plugin and the `REQUEST_INSTALL_PACKAGES` permission are applied at
prebuild time.

## Stack

- Expo SDK 58, React Native 0.88, TypeScript 6 (strict)
- Tailwind CSS v4 through [uniwind](https://uniwind.dev/)
- expo-router, Zustand 5, expo-video, Reanimated 4

## Development

| Command | What it does |
|---|---|
| `bun run android` | Build and run on a device or emulator |
| `bun run start` | Dev server |
| `bun run typecheck` | Typecheck |
| `bun run lint` | ESLint via `expo lint` |
| `bun run check` | Run every `*.check.ts` self-check |
| `bun run release` | Bump, tag and push a release |

`@/*` resolves to `src/*`.

CI runs all of the above plus `expo-doctor` on every push and pull request.

## Releases

Releases are cut from tags and built on GitHub Actions.

```bash
bun run release 1.0.1
```

The script refuses to run unless the working tree is clean, you are on `main`,
the version differs from the current one, both version files agree and the tag
`vX.Y.Z` does not exist yet. It then bumps `version` in `app.json` and
`package.json`, commits with `chore(release): vX.Y.Z`, tags and pushes both. Add
`--dry-run` to see the plan without touching anything.

The release workflow runs the checks, fails unless the tag matches both
versions, builds a signed APK with `eas build --local`, and publishes a GitHub
Release with the APK attached. Notes are generated from the commits since the
previous tag.

The build runs on the GitHub runner and uses no EAS build minutes. The Android
keystore is stored and managed by EAS, so the only secret the workflow needs is
the `EXPO_TOKEN` repository secret.

`android.versionCode` is not tracked in this repository. `eas.json` sets
`appVersionSource: "remote"` and `autoIncrement: true`, so EAS owns the
versionCode and increments it on every production build. The version that
users see lives in `app.json` (`expo.version`) and `package.json` (`version`),
and the two must match.

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
