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
import { persistWithRollback } from "../utils/history";

export const DOWNLOADS_KEY = "downloads_index";
export const DOWNLOAD_CONCURRENCY_KEY = "downloads_concurrency";

export const MIN_DOWNLOAD_CONCURRENCY = 1;
export const MAX_DOWNLOAD_CONCURRENCY = 3;
export const DEFAULT_DOWNLOAD_CONCURRENCY = 1;

export type DownloadStatus = "queued" | "downloading" | "done" | "error";

export interface DownloadEntry {
  slug: string;
  number: string;
  title: string;
  image: string;
  language: string | null;
  status: DownloadStatus;
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
  setConcurrency: (value: number) => Promise<void>;
}

export function downloadKey(slug: string, number: string): string {
  return `${slug}_${number}`;
}

export function clampConcurrency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DOWNLOAD_CONCURRENCY;
  return Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(MIN_DOWNLOAD_CONCURRENCY, Math.round(value)));
}

// Worker pool stays outside the store: it is lifecycle, not rendered state
const queue: DownloadInput[] = [];
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

async function runDownload(input: DownloadInput): Promise<void> {
  const key = downloadKey(input.slug, input.number);
  const controller = new AbortController();
  controllers.set(key, controller);
  activeWorkers += 1;
  updateEntry(key, { status: "downloading", error: null, segmentsDone: 0, segmentsTotal: 0, bytes: 0 });

  try {
    const result = await downloadEpisode(
      { slug: input.slug, number: input.number, language: useDownloadsStore.getState().entries[key]?.language ?? null },
      (progress) => {
        updateEntry(key, {
          segmentsDone: progress.segmentsDone,
          segmentsTotal: progress.segmentsTotal,
          bytes: progress.bytesDone,
        });
      },
      controller.signal,
    );
    updateEntry(key, {
      status: "done",
      language: result.language,
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
    persist(useDownloadsStore.getState().entries);
    pump();
  }
}

function withoutKey(entries: Record<string, DownloadEntry>, key: string): Record<string, DownloadEntry> {
  const next = { ...entries };
  delete next[key];
  return next;
}

function pump(): void {
  const { concurrency, entries } = useDownloadsStore.getState();
  while (activeWorkers < concurrency && queue.length > 0) {
    const input = queue.shift();
    if (input == null) break;
    const key = downloadKey(input.slug, input.number);
    // Removed or finished while it waited: nothing to download
    if (entries[key]?.status !== "queued") continue;
    void runDownload(input);
  }
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  entries: {},
  concurrency: DEFAULT_DOWNLOAD_CONCURRENCY,

  initialize: (entries, concurrency) => {
    const next: Record<string, DownloadEntry> = {};
    const resumable: DownloadInput[] = [];

    for (const entry of entries) {
      const key = downloadKey(entry.slug, entry.number);
      // Downloads whose files vanished are dropped instead of offered as playable
      if (entry.status === "done" && !isEpisodeDownloaded(entry.slug, entry.number)) {
        logger.info("download", `Dropping ${key}: playlist missing`);
        continue;
      }
      const normalized = entry.status === "downloading" ? { ...entry, status: "queued" as const } : entry;
      next[key] = normalized;
      if (normalized.status === "queued") {
        resumable.push({ slug: entry.slug, number: entry.number, title: entry.title, image: entry.image });
      }
    }

    set({ entries: next, concurrency: clampConcurrency(concurrency) });
    // An interrupted queue resumes: segment files already on disk are skipped
    for (const input of resumable) {
      if (!queue.some((q) => downloadKey(q.slug, q.number) === downloadKey(input.slug, input.number))) {
        queue.push(input);
      }
    }
    pump();
  },

  enqueue: (input) => {
    const key = downloadKey(input.slug, input.number);
    const existing = get().entries[key];
    if (existing?.status === "queued" || existing?.status === "downloading" || existing?.status === "done") return;

    const entry: DownloadEntry = {
      slug: input.slug,
      number: input.number,
      title: input.title,
      image: input.image,
      language: null,
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
    queue.push(input);
    pump();
  },

  cancel: (key) => {
    controllers.get(key)?.abort();
    const index = queue.findIndex((item) => downloadKey(item.slug, item.number) === key);
    if (index >= 0) queue.splice(index, 1);
    const rest = withoutKey(get().entries, key);
    set({ entries: rest });
    persist(rest);
  },

  remove: async (key) => {
    const entry = get().entries[key];
    if (entry == null) return;
    controllers.get(key)?.abort();
    const previous = get().entries;
    const rest = withoutKey(previous, key);
    set({ entries: rest });
    try {
      deleteEpisodeDownload(entry.slug, entry.number);
    } catch (error) {
      logger.warn("download", `Failed to delete files for ${key}`, error);
    }
    await persistWithRollback(
      () => storage.set(DOWNLOADS_KEY, Object.values(rest)),
      () => set({ entries: previous }),
      "downloadsStore",
    );
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
