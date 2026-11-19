import { create } from "zustand";
import {
  deleteEpisodeDownload,
  downloadEpisode,
  isEpisodeDownloaded,
  toDownloadError,
  type EpisodeTarget,
} from "../services/downloader";
import { storage } from "../utils/storage";
import { logger } from "../utils/logger";
import { downloadKey, isWaiting, resumeTargets, type DownloadStatus, type QueuedEntry } from "../utils/downloadQueue";

export { downloadKey };
export type { DownloadStatus };

export const DOWNLOADS_KEY = "downloads_index";
export const DOWNLOAD_CONCURRENCY_KEY = "downloads_concurrency";

export const MIN_DOWNLOAD_CONCURRENCY = 1;
export const MAX_DOWNLOAD_CONCURRENCY = 3;
export const DEFAULT_DOWNLOAD_CONCURRENCY = 1;

export interface DownloadEntry extends QueuedEntry {
  segmentsDone: number;
  segmentsTotal: number;
  bytes: number;
  playlistUri: string | null;
  error: string | null;
  createdAt: number;
}

export type DownloadInput = EpisodeTarget & { title: string; image: string };

interface DownloadsState {
  entries: Record<string, DownloadEntry>;
  concurrency: number;
  initialize: (entries: DownloadEntry[], concurrency: number) => void;
  enqueue: (input: DownloadInput) => void;
  cancel: (key: string) => void;
  remove: (key: string) => Promise<void>;
  /** Drops every language saved for one episode. */
  removeEpisode: (slug: string, number: string) => Promise<void>;
  setConcurrency: (value: number) => Promise<void>;
}


/** Every entry of one episode, whatever language it belongs to. */
export function entriesForEpisode(
  entries: Record<string, DownloadEntry>,
  slug: string,
  number: string,
): DownloadEntry[] {
  return Object.values(entries).filter((entry) => entry.slug === slug && entry.number === number);
}

export function downloadedForEpisode(
  entries: Record<string, DownloadEntry>,
  slug: string,
  number: string,
): DownloadEntry[] {
  return entriesForEpisode(entries, slug, number).filter((entry) => entry.status === "done");
}

/** The entry that owns the episode's button: work in flight wins, then done. */
export function activeEntryForEpisode(
  entries: Record<string, DownloadEntry>,
  slug: string,
  number: string,
): DownloadEntry | undefined {
  const mine = entriesForEpisode(entries, slug, number);
  return (
    mine.find((entry) => entry.status === "downloading") ??
    mine.find((entry) => entry.status === "queued") ??
    mine.find((entry) => entry.status === "done") ??
    mine.find((entry) => entry.status === "error")
  );
}

export function clampConcurrency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DOWNLOAD_CONCURRENCY;
  return Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(MIN_DOWNLOAD_CONCURRENCY, Math.round(value)));
}

// Worker pool stays outside the store: it is lifecycle, not rendered state
type QueuedDownload = { input: DownloadInput; resume: boolean };
const queue: QueuedDownload[] = [];
const controllers = new Map<string, AbortController>();
let activeWorkers = 0;

function persist(entries: Record<string, DownloadEntry>): void {
  // Interrupted downloads persist as queued: the app resumes them on boot
  const snapshot = Object.values(entries).map((entry) =>
    entry.status === "downloading" ? { ...entry, status: "queued" as const } : entry,
  );
  void storage.set(DOWNLOADS_KEY, snapshot).catch((error) => {
    logger.warn("downloadsStore", "Failed to persist index", error);
  });
}

function updateEntry(
  key: string,
  patch: Partial<DownloadEntry> | ((entry: DownloadEntry) => Partial<DownloadEntry>),
): void {
  const { entries } = useDownloadsStore.getState();
  const existing = entries[key];
  if (existing == null) return;
  const next = typeof patch === "function" ? patch(existing) : patch;
  useDownloadsStore.setState({ entries: { ...entries, [key]: { ...existing, ...next } } });
}

async function runDownload(input: DownloadInput, resume: boolean): Promise<void> {
  const key = downloadKey(input.slug, input.number, input.language ?? null);
  const target = {
    slug: input.slug,
    number: input.number,
    language: useDownloadsStore.getState().entries[key]?.language ?? null,
  };
  const controller = new AbortController();
  controllers.set(key, controller);
  activeWorkers += 1;
  updateEntry(key, { status: "downloading", error: null, segmentsDone: 0, segmentsTotal: 0, bytes: 0 });

  try {
    const result = await downloadEpisode(
      target,
      (progress) => {
        updateEntry(key, {
          segmentsDone: progress.segmentsDone,
          segmentsTotal: progress.segmentsTotal,
          bytes: progress.bytesDone,
        });
      },
      controller.signal,
      { resume },
    );
    updateEntry(key, {
      status: "done",
      bytes: result.bytes,
      segmentsTotal: result.segmentsTotal,
      segmentsDone: result.segmentsTotal,
      playlistUri: result.playlistUri,
      error: null,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      logger.info("download", `Cancelled ${key}`);
    } else {
      const appError = toDownloadError(error);
      logger.warn("download", `Failed ${key}: ${appError.message}`, error);
      updateEntry(key, { status: "error", error: appError.message });
    }
  } finally {
    controllers.delete(key);
    activeWorkers -= 1;
    // The cancel path deletes the folder while segments are still landing, so
    // a cancelled worker cleans up after itself once it has stopped writing
    if (controller.signal.aborted) {
      try {
        deleteEpisodeDownload(target.slug, target.number, target.language);
      } catch (error) {
        logger.warn("download", `Failed to delete files for ${key}`, error);
      }
    }
    persist(useDownloadsStore.getState().entries);
    pump();
  }
}

function withoutKey(entries: Record<string, DownloadEntry>, key: string): Record<string, DownloadEntry> {
  const next = { ...entries };
  delete next[key];
  return next;
}

async function persistRemoval(entries: Record<string, DownloadEntry>): Promise<void> {
  try {
    await storage.set(DOWNLOADS_KEY, Object.values(entries));
  } catch (error) {
    logger.error("downloadsStore", "Failed to persist the removal", error);
  }
}

function pump(): void {
  const { concurrency, entries } = useDownloadsStore.getState();
  while (activeWorkers < concurrency && queue.length > 0) {
    const nextItem = queue.shift();
    if (nextItem == null) break;
    const key = downloadKey(nextItem.input.slug, nextItem.input.number, nextItem.input.language ?? null);
    // Removed, finished or mismatched while it waited: nothing to download
    if (!isWaiting(entries, key)) continue;
    void runDownload(nextItem.input, nextItem.resume);
  }
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  entries: {},
  concurrency: DEFAULT_DOWNLOAD_CONCURRENCY,

  initialize: (entries, concurrency) => {
    const next: Record<string, DownloadEntry> = {};

    for (const entry of entries) {
      const key = downloadKey(entry.slug, entry.number, entry.language);
      // Downloads whose files vanished are dropped instead of offered as playable
      if (entry.status === "done" && !isEpisodeDownloaded(entry.slug, entry.number, entry.language)) {
        logger.info("download", `Dropping ${key}: playlist missing`);
        continue;
      }
      next[key] = entry.status === "downloading" ? { ...entry, status: "queued" } : entry;
    }

    set({ entries: next, concurrency: clampConcurrency(concurrency) });
    // An interrupted queue resumes: segment files already on disk are skipped,
    // and the language travels along so the worker finds the same entry
    for (const target of resumeTargets(Object.values(next))) {
      const key = downloadKey(target.slug, target.number, target.language);
      if (!queue.some((q) => downloadKey(q.input.slug, q.input.number, q.input.language ?? null) === key)) {
        queue.push({ input: target, resume: true });
      }
    }
    pump();
  },

  enqueue: (input) => {
    const key = downloadKey(input.slug, input.number, input.language ?? null);
    const existing = get().entries[key];
    if (existing?.status === "queued" || existing?.status === "downloading" || existing?.status === "done") return;

    const entry: DownloadEntry = {
      slug: input.slug,
      number: input.number,
      title: input.title,
      image: input.image,
      language: input.language ?? null,
      status: "queued",
      segmentsDone: 0,
      segmentsTotal: 0,
      bytes: 0,
      playlistUri: null,
      error: null,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set({ entries: { ...get().entries, [key]: entry } });
    persist(get().entries);
    // A user request starts clean: leftovers of a cancelled attempt are dropped
    queue.push({ input, resume: false });
    pump();
  },

  cancel: (key) => {
    const entry = get().entries[key];
    controllers.get(key)?.abort();
    const index = queue.findIndex((item) => downloadKey(item.input.slug, item.input.number, item.input.language ?? null) === key);
    if (index >= 0) queue.splice(index, 1);
    const rest = withoutKey(get().entries, key);
    set({ entries: rest });
    persist(rest);
    // Leaving the segments behind would hide them from the index and keep the
    // bytes on disk forever; a cancelled episode is not worth keeping
    if (entry != null) {
      try {
        deleteEpisodeDownload(entry.slug, entry.number, entry.language);
      } catch (error) {
        logger.warn("download", `Failed to delete files for ${key}`, error);
      }
    }
  },

  remove: async (key) => {
    const entry = get().entries[key];
    if (entry == null) return;
    controllers.get(key)?.abort();
    const rest = withoutKey(get().entries, key);
    set({ entries: rest });
    try {
      deleteEpisodeDownload(entry.slug, entry.number, entry.language);
    } catch (error) {
      logger.warn("download", `Failed to delete files for ${key}`, error);
    }
    // The files are gone: restoring the entry on a failed write would offer a
    // download that cannot play. Memory keeps the removal and the next
    // successful write persists it.
    await persistRemoval(rest);
  },

  removeEpisode: async (slug, number) => {
    const previous = get().entries;
    const mine = entriesForEpisode(previous, slug, number);
    let rest = previous;
    for (const entry of mine) {
      const key = downloadKey(slug, number, entry.language);
      controllers.get(key)?.abort();
      const index = queue.findIndex(
        (item) => downloadKey(item.input.slug, item.input.number, item.input.language ?? null) === key,
      );
      if (index >= 0) queue.splice(index, 1);
      rest = withoutKey(rest, key);
      try {
        deleteEpisodeDownload(slug, number, entry.language);
      } catch (error) {
        logger.warn("download", `Failed to delete files for ${key}`, error);
      }
    }
    set({ entries: rest });
    await persistRemoval(rest);
  },

  setConcurrency: async (value) => {
    const concurrency = clampConcurrency(value);
    const previous = get().concurrency;
    set({ concurrency });
    // A raised cap must reach a queue that is already waiting
    pump();
    try {
      await storage.set(DOWNLOAD_CONCURRENCY_KEY, concurrency);
    } catch (error) {
      set({ concurrency: previous });
      logger.error("downloadsStore", "Failed to persist concurrency", error);
    }
  },
}));
