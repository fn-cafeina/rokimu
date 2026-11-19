import type { AnimeDetail } from "../types";
import { isAnimeDetail } from "./detailShape";
import { logger } from "./logger";
import { storage } from "./storage";

/**
 * Detail kept outside the TTL cache, for as long as it is worth opening with no
 * connection: a library anime, or one with downloaded episodes. The cache
 * expires and is pruned at boot, and without the episode list a saved download
 * has no entry point, since the sheet opens from the detail screen.
 */
export const ANIME_SNAPSHOT_PREFIX = "anime_snapshot_";

const keyFor = (slug: string) => `${ANIME_SNAPSHOT_PREFIX}${slug}`;

export async function saveAnimeSnapshot(slug: string, detail: AnimeDetail): Promise<void> {
  try {
    await storage.set(keyFor(slug), detail);
  } catch (error) {
    // An offline copy is a convenience; a failed write must not block the screen
    logger.warn("snapshot", `Failed to save the detail of ${slug}`, error);
  }
}

export async function loadAnimeSnapshot(slug: string): Promise<AnimeDetail | null> {
  const value = await storage.get<unknown>(keyFor(slug));
  if (value == null) return null;
  if (!isAnimeDetail(value)) {
    logger.warn("snapshot", `Discarding a malformed detail for ${slug}`);
    void forgetAnimeSnapshot(slug);
    return null;
  }
  return value;
}

export function forgetAnimeSnapshot(slug: string): Promise<void> {
  return storage.remove(keyFor(slug));
}

/** Boot sweep: a copy nobody can reach only counts against the storage cap. */
export async function pruneAnimeSnapshots(keep: (slug: string) => boolean): Promise<void> {
  const keys = await storage.getAllKeys();
  const stale = keys
    .filter((key) => key.startsWith(ANIME_SNAPSHOT_PREFIX))
    .map((key) => key.slice(ANIME_SNAPSHOT_PREFIX.length))
    .filter((slug) => !keep(slug));
  await Promise.all(stale.map(forgetAnimeSnapshot));
}
