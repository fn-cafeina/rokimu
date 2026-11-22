import { useDownloadsStore, DOWNLOADS_KEY, DOWNLOAD_CONCURRENCY_KEY, DEFAULT_DOWNLOAD_CONCURRENCY, type DownloadEntry } from "@/stores/downloadsStore";
import { useHistoryStore, HISTORY_KEY } from "@/stores/historyStore";
import { useSavedStore, SAVED_KEY } from "@/stores/savedStore";
import { useSettingsStore, EPISODE_ORDER_KEY, EPISODE_ORDER_BY_SLUG_KEY, PREFERRED_SERVER_KEY } from "@/stores/settingsStore";
import { useUpdateStore, UPDATE_CHECK_KEY } from "@/stores/updateStore";
import { isWorthKeepingOffline } from "@/hooks/useAnimeSnapshot";
import { prunePersistedRanges } from "@/hooks/useAnimeDetail";
import { resetToPortrait } from "@/services/playerUI";
import { sessionManager } from "@/services/session";
import { pruneAnimeSnapshots } from "@/utils/animeSnapshot";
import { pruneExpiredCache } from "@/utils/cache";
import { logger } from "@/utils/logger";
import { storage } from "@/utils/storage";
import type { Anime, HistoryItem } from "@/types";

const UPDATE_CHECK_ATTEMPTS = 3;
const UPDATE_CHECK_RETRY_DELAY = 2000;

function runUpdateCheckWithRetry(attempt = 1): void {
  void useUpdateStore.getState().checkForUpdates().then((ok) => {
    const { updateCheckEnabled } = useUpdateStore.getState();
    if (!ok && updateCheckEnabled !== false && attempt < UPDATE_CHECK_ATTEMPTS) {
      setTimeout(() => runUpdateCheckWithRetry(attempt + 1), UPDATE_CHECK_RETRY_DELAY * attempt);
    }
  });
}

/**
 * Hydrates every persisted store, then runs the housekeeping sweeps.
 * The root layout only waits on this promise before rendering the routes.
 */
export async function bootApp(): Promise<void> {
  await resetToPortrait();
  // Fire and forget: the sweep is IO over every stored key, nothing waits on it
  void pruneExpiredCache();
  await sessionManager.initialize();
  // One batch: the slowest read bounds boot, not the sum of two batches
  const [history, saved, order, orderBySlug, preferredServer, updateCheckEnabled, downloads, downloadConcurrency] = await Promise.all([
    storage.get<HistoryItem[]>(HISTORY_KEY),
    storage.get<Anime[]>(SAVED_KEY),
    storage.get<"asc" | "desc">(EPISODE_ORDER_KEY),
    storage.get<Record<string, "asc" | "desc">>(EPISODE_ORDER_BY_SLUG_KEY),
    storage.get<"Delta" | "Epsilon" | null>(PREFERRED_SERVER_KEY),
    storage.get<boolean>(UPDATE_CHECK_KEY),
    storage.get<DownloadEntry[]>(DOWNLOADS_KEY),
    storage.get<number>(DOWNLOAD_CONCURRENCY_KEY),
  ]);
  useHistoryStore.getState().initialize(history ?? []);
  useSavedStore.getState().initialize(saved ?? []);
  useSettingsStore.getState().initialize(order ?? "asc", preferredServer, orderBySlug ?? {});
  useUpdateStore.getState().initialize(updateCheckEnabled !== false);
  useDownloadsStore.getState().initialize(downloads ?? [], downloadConcurrency ?? DEFAULT_DOWNLOAD_CONCURRENCY);
  // Stored detail and episode ranges outlive the cache, so the sweep waits
  // for the lists that decide what is still worth keeping offline
  void pruneAnimeSnapshots(isWorthKeepingOffline);
  void prunePersistedRanges(isWorthKeepingOffline);
  logger.info("lifecycle", "App boot complete");

  if (updateCheckEnabled !== false) {
    runUpdateCheckWithRetry();
  }
}
