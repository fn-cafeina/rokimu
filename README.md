<img src="assets/images/icon.png" alt="Rokimu" width="120" />

# Rokimu

Anime for Android, without the clutter.

[![Download APK](https://img.shields.io/github/v/release/fn-cafeina/rokimu?label=Download%20APK&style=for-the-badge&labelColor=0d1117&color=2ea44f)](https://github.com/fn-cafeina/rokimu/releases/latest)
[![License](https://img.shields.io/github/license/fn-cafeina/rokimu?style=for-the-badge&labelColor=0d1117)](LICENSE)

Rokimu is a small client for watching anime on a phone. No feed of
recommendations, no comments, no profile. You look something up, you watch it,
it remembers where you stopped, and it keeps what you download.

> [!WARNING]
> Nothing is hosted here. Episodes come from the site Rokimu reads, so what you
> can watch depends on that site being reachable from your network.

## Download

[Download the latest APK](https://github.com/fn-cafeina/rokimu/releases/latest), allow
installs from your browser when Android asks, and open the file. Builds cover
both 32- and 64-bit ARM phones.

After that the app updates itself: Settings holds the check and the install.

## Features

- **Library first.** The app opens on what you saved. Save an anime from its
  page and it is there next time.
- **Something to browse.** The search tab shows the latest additions until you
  type, then it becomes search. The feed scrolls on its own, and type, status,
  year and genre narrow it together.
- **Your language.** Subtitled, Latino or Castellano, whichever the episode
  carries.
- **A second server.** Coral or Jade, or leave it on Auto.
- **It remembers.** Every episode row shows how far you got, and the player
  picks up from there. Finished episodes hand you the next one.
- **Watch it later.** Download an episode and it plays from your phone with no
  connection, even when the site is down.
- **Nothing to set up.** No account, no ads, dark and portrait, one hand.

## Your data

Saved anime, watch progress and downloads stay on the phone. There is nothing
to sign in to, nothing to sync and no server of ours holding a copy.

## Build it

```bash
bun install
bunx expo prebuild --platform android
bun run android
```

Needs bun, JDK 17 and the Android SDK. `AGENTS.md` covers the code and the
release process.

## License

MIT. See [LICENSE](LICENSE).

Rokimu is an independent client, unaffiliated with any site it reads. Content
belongs to its authors and rightsholders.
