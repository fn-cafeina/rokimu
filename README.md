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

Rokimu needs a development build. It does not run in Expo Go: the
`REQUEST_INSTALL_PACKAGES` permission is applied at prebuild time.

## Stack

- Expo SDK 58, React Native 0.88, TypeScript 6 (strict)
- Tailwind CSS v4 through [uniwind](https://uniwind.dev/)
- expo-router, Zustand 5, expo-video, Reanimated 4

## How it works

- **Transport.** Source requests run inside a hidden WebView worker, so the
  page's own cookie jar (HttpOnly included) answers and the app never reads a
  cookie. `fetchWithSession` is the native path for the same origin; a 403 or a
  Cloudflare challenge enters the wash-and-retry ladder. Foreign video hosts
  never trigger a session wash.
- **Streams.** Delta (shown as Coral) resolves through its Byse AES-GCM API,
  Epsilon (shown as Jade) through a LuluStream embed. The preferred server in
  Settings only reorders the ladder: playback plays the chosen server or
  fails, it does not substitute another.
- **Downloads.** The playlist is rewritten to a local `index.m3u8`; segments
  keep their encryption and the player decrypts them. The segment pool size
  follows the CDN host that serves the bytes, because one CDN rate-limits
  above four requests.
- **Update check.** The app compares its version with the latest release and
  installs the APK through `REQUEST_INSTALL_PACKAGES`.

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

CI runs `typecheck`, `check`, `lint` and `expo-doctor` on every push and pull
request, and the release workflow reuses that job before building.

## Releases

Releases are cut from tags and built on GitHub Actions.

```bash
bun run release patch   # 1.2.4 -> 1.2.5
bun run release minor   # 1.2.4 -> 1.3.0
bun run release major   # 1.2.4 -> 2.0.0
bun run release 1.3.0   # explicit version
```

The bump words work the way `npm version` does; an explicit `X.Y.Z` is taken
as-is. The script refuses to run unless the working tree is clean, you are on
`main`, the resolved version differs from the current one, both version files
agree and the tag `vX.Y.Z` does not exist yet. It then bumps `version` in
`app.json` and `package.json`, commits with `chore(release): vX.Y.Z`, tags and
pushes both. Add `--dry-run` to see the plan and the version it would land on
without touching anything.

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

- `app/`: file-based routes through `expo-router` — `(tabs)` (library, search,
  settings), `anime/[slug]`, `player`
- `src/components/`: UI grouped by area (`anime`, `app`, `downloads`, `player`,
  `search`, `ui`)
- `src/hooks/`: screen and data hooks
- `src/stores/`: Zustand stores — catalog, details, search, saved, history,
  downloads, player, settings, update
- `src/services/`: HTTP client and WebView worker, HTML/RSC parsers,
  Cloudflare session, stream extractors, HLS, downloader, boot, updater
- `src/config/`: source URLs, cache prefixes and TTLs, player config, theme
- `src/utils/`: cache, storage, persistence, download queue, retry, CDN tuning,
  server order, logger, navigation

## Legal

Rokimu is an independent third-party client. It is not affiliated with,
endorsed by, or sponsored by any service or content provider it may access.

The app does not host, store, or distribute anime content. All content
belongs to its respective authors and rightsholders.

Users are responsible for the content they access through the app.

## License

MIT. See [LICENSE](LICENSE).
