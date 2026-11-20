import { Directory, File, Paths } from "expo-file-system";
import { TIMEOUTS } from "@/config/cache";
import type { AppError } from "@/types";
import { SourceError, isCancelled } from "@/utils/errors";
import { segmentConcurrency } from "@/utils/cdn";
import { backoffDelay } from "@/utils/math";
import { logger } from "@/utils/logger";
import { withAuthRetry } from "@/utils/retry";
import { orderServers } from "@/utils/serverOrder";
import { useSettingsStore } from "@/stores/settingsStore";
import { source } from "./source";
import {
  buildLocalPlaylist,
  parseMediaPlaylist,
  sequenceIv,
  type HlsInitSegment,
  type HlsMediaPlaylist,
  type HlsSegment,
} from "./hls";

// Every segment is decrypted in pure JS (AES-128 CBC) and crosses the bridge
// One segment is retried on 429/5xx before the worker gives up
const DOWNLOAD_ATTEMPTS = 3;
// A transfer that stops moving is aborted: a dead socket otherwise holds one
// worker forever and, with concurrency 1, the whole queue behind it
const STALL_TIMEOUT_MS = 45_000;

export const DOWNLOADS_DIR = "downloads";
export const PLAYLIST_FILE = "index.m3u8";
// Marks a folder as written in the current format: segments stay encrypted and
// the local playlist carries their key. Older folders were decrypted in place.
const FORMAT_MARKER = "format";
const FORMAT_VERSION = "aes-key-v1";

export interface EpisodeTarget {
  slug: string;
  number: string;
  /** Server language. Without one, the first server is used and the folder is "default". */
  language?: string | null;
}

export interface EpisodeDownloadProgress {
  segmentsDone: number;
  segmentsTotal: number;
  bytesDone: number;
}

export interface EpisodeDownloadResult {
  dirUri: string;
  playlistUri: string;
  bytes: number;
  segmentsTotal: number;
}

/** One folder per language: an episode can keep Latino and Subtitulado at once. */
function languageDir(language: string | null): string {
  const normalized = (language ?? "").normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return normalized === "" || normalized === "-" ? "default" : normalized;
}

export function episodeDirectory(slug: string, number: string, language: string | null): Directory {
  return new Directory(Paths.document, DOWNLOADS_DIR, slug, `ep-${number}-${languageDir(language)}`);
}

export function episodePlaylist(slug: string, number: string, language: string | null): File {
  return new File(episodeDirectory(slug, number, language), PLAYLIST_FILE);
}

export function isEpisodeDownloaded(slug: string, number: string, language: string | null): boolean {
  return episodePlaylist(slug, number, language).exists;
}

export function deleteEpisodeDownload(slug: string, number: string, language: string | null): void {
  const dir = episodeDirectory(slug, number, language);
  if (dir.exists) dir.delete();
}

function extensionOf(uri: string, fallback: string): string {
  try {
    const name = new URL(uri).pathname.split("/").pop() ?? "";
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot) : fallback;
  } catch {
    return fallback;
  }
}

function segmentFileName(index: number, uri: string): string {
  return `seg_${String(index).padStart(5, "0")}${extensionOf(uri, ".ts")}`;
}

function rangeHeaders(range: { length: number; offset: number } | null): Record<string, string> {
  if (range == null) return {};
  return { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` };
}

interface RequestGuard {
  signal: AbortSignal;
  /** Restarts the stall timer: called whenever bytes move. */
  touch: () => void;
  release: () => void;
}

/** Ties a per-request abort to the caller signal and to a stall timer. */
function guardRequest(signal: AbortSignal, timeoutMs: number): RequestGuard {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", onAbort, { once: true });

  let timer: ReturnType<typeof setTimeout>;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  touch();

  return {
    signal: controller.signal,
    touch,
    release: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

/** A guard abort is a timeout, not a user cancellation, and says so. */
function settleRequestError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted) return error;
  if ((error as { name?: string } | null)?.name === "AbortError") {
    return new SourceError("La descarga se quedó sin respuesta", "TIMEOUT");
  }
  return error;
}

/** The native downloader reports the HTTP status only inside its error message. */
function statusOf(error: unknown): number | null {
  const message = error instanceof Error ? error.message : "";
  const match = /status: (\d{3})/.exec(message);
  return match?.[1] != null ? parseInt(match[1], 10) : null;
}

/**
 * Network failures arrive as native exception names, not as HTTP statuses: a
 * connect timeout or a reset connection is worth another attempt, a refused
 * certificate is not.
 */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /SocketTimeoutException|ConnectException|SSLException|UnknownHostException|failed to connect|Unable to resolve host|Connection reset|connection abort|stream was reset/i.test(
    message,
  );
}

async function downloadTo(
  url: string,
  target: File,
  headers: Record<string, string>,
  signal: AbortSignal,
  range: { length: number; offset: number } | null = null,
): Promise<File> {
  for (let attempt = 0; ; attempt++) {
    const guard = guardRequest(signal, STALL_TIMEOUT_MS);
    try {
      // The native downloader decides where the bytes land: its answer is the
      // only path worth reading back. Trusting the path we asked for raced with
      // a file the native side had already moved or dropped.
      const written = await File.downloadFileAsync(url, target, {
        idempotent: true,
        headers: { ...headers, ...rangeHeaders(range) },
        signal: guard.signal,
        onProgress: () => guard.touch(),
      });
      if (!written.exists || written.size === 0) {
        // An empty landing is the CDN dropping the body, not a dead segment
        if (attempt >= DOWNLOAD_ATTEMPTS - 1) throw new SourceError("La descarga quedó vacía", "VIDEO_ERROR");
        const wait = backoffDelay(attempt);
        logger.warn("download", `Empty download, retrying in ${wait}ms (${attempt + 1}/${DOWNLOAD_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      return written;
    } catch (error) {
      const settled = settleRequestError(error, signal);
      const status = statusOf(error);
      // The CDN refuses bursts with 429, and a dropped socket drops one segment:
      // neither is worth losing the whole episode over
      const retryable = status === 429 || (status != null && status >= 500) || isTransient(error);
      if (!retryable || attempt >= DOWNLOAD_ATTEMPTS - 1 || signal.aborted) throw settled;
      const wait = status === 429 ? 2_000 * (attempt + 1) : backoffDelay(attempt);
      const reason = status != null ? `HTTP ${status}` : "Network error";
      logger.warn("download", `${reason} from the CDN, retrying in ${wait}ms (${attempt + 1}/${DOWNLOAD_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    } finally {
      guard.release();
    }
  }
}

async function fetchText(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<string> {
  const guard = guardRequest(signal, TIMEOUTS.REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { headers, signal: guard.signal });
    if (!res.ok) throw new SourceError(`HTTP ${res.status} al descargar el playlist`, "VIDEO_ERROR");
    return await res.text();
  } catch (error) {
    throw settleRequestError(error, signal);
  } finally {
    guard.release();
  }
}

async function fetchBytes(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Uint8Array> {
  const guard = guardRequest(signal, TIMEOUTS.REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { headers, signal: guard.signal });
    if (!res.ok) throw new SourceError(`HTTP ${res.status} al descargar la clave`, "VIDEO_ERROR");
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    throw settleRequestError(error, signal);
  } finally {
    guard.release();
  }
}

async function pickStream(
  target: EpisodeTarget,
  signal: AbortSignal,
): Promise<{ stream: { url: string; headers: Record<string, string> }; playlist: HlsMediaPlaylist }> {
  // Downloads go through the same ladder as playback: a session that expired
  // while the app sat in the background must not turn a download into an error
  const servers = await withAuthRetry(
    () => source.getEpisodeServers(target.slug, target.number, { signal }),
    { signal, tag: "download" },
  );
  if (servers.length === 0) throw new SourceError("No hay servidor disponible", "VIDEO_ERROR");
  // The user's preferred server jumps the queue so a dead default never costs
  // its timeout; the rest keep the site's order for the fallback ladder
  const ordered = orderServers(servers, useSettingsStore.getState().preferredServer);
  // A requested language is not negotiable: downloading another audio track
  // under that label would be a silent lie to the user. Without one, every
  // server is a candidate in the order the site lists them.
  const candidates =
    target.language != null ? ordered.filter((s) => s.language === target.language) : ordered;
  if (candidates.length === 0) {
    throw new SourceError(`No hay servidor en ${target.language} para este episodio`, "VIDEO_ERROR");
  }

  // One dead server must not kill the download while another of the same
  // language survives: each candidate gets a full resolve-and-parse before
  // the next one is tried
  let lastError: unknown = new SourceError("No se pudo resolver el stream", "VIDEO_ERROR");
  for (const server of candidates) {
    try {
      const resolved = await withAuthRetry(
        () => source.resolveStreamUrl(server.url, { signal }),
        { signal, tag: "download" },
      );
      if (resolved == null) throw new SourceError("No se pudo resolver el stream", "VIDEO_ERROR");
      const headers = resolved.headers ?? {};
      logger.info("download", `Resolving playlist for ${target.slug} ep ${target.number}`);
      const body = await fetchText(resolved.url, headers, signal);
      const playlist = parseMediaPlaylist(body, resolved.url);
      if (playlist.segments.length === 0) {
        throw new SourceError("El playlist no tiene segmentos", "VIDEO_ERROR");
      }
      return { stream: { url: resolved.url, headers }, playlist };
    } catch (error) {
      if (isCancelled(error)) throw error;
      lastError = error;
      logger.warn("download", `Server ${server.id} (${server.language}) failed, trying next`, error);
    }
  }
  throw lastError;
}

async function downloadInit(
  init: HlsInitSegment,
  dir: Directory,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ file: string; bytes: number }> {
  const name = `init${extensionOf(init.uri, ".mp4")}`;
  const file = new File(dir, name);
  if (file.exists && file.size > 0) {
    return { file: name, bytes: file.size };
  }
  // The playlist must point at the name on disk, not the one we asked for
  const written = await downloadTo(init.uri, file, headers, signal, init.range);
  return { file: written.name, bytes: written.size };
}

/** Where the download time actually goes, per phase, readable in one log line. */
interface SegmentStats {
  count: number;
  downloadMs: number;
  downloadBytes: number;
  writeMs: number;
}

async function downloadSegment(
  segment: HlsSegment,
  index: number,
  dir: Directory,
  headers: Record<string, string>,
  signal: AbortSignal,
  stats: SegmentStats,
): Promise<number> {
  const name = segmentFileName(index, segment.uri);
  const file = new File(dir, name);

  // A file from an interrupted run is kept: resuming skips what is already there
  if (file.exists && file.size > 0) {
    return file.size;
  }

  // Landing in a .part file keeps a half-written segment from ever looking
  // complete to the resume check
  const part = new File(dir, `${name}.part`);
  const downloadStarted = Date.now();
  const written = await downloadTo(segment.uri, part, headers, signal, segment.range);
  stats.downloadMs += Date.now() - downloadStarted;
  stats.downloadBytes += written.size;
  stats.count += 1;

  // Bytes land on disk as the CDN served them: an encrypted segment stays
  // encrypted and the player decrypts it natively at playback time
  const writeStarted = Date.now();
  await written.move(file);
  stats.writeMs += Date.now() - writeStarted;

  return file.size;
}

/**
 * Downloads one episode as a self-contained HLS folder: init segment, raw
 * segments and a rewritten playlist pointing at local files and local keys.
 * ExoPlayer then plays the folder offline through `expo-video`.
 */
export async function downloadEpisode(
  target: EpisodeTarget,
  onProgress: (progress: EpisodeDownloadProgress) => void,
  signal: AbortSignal,
  options: { resume?: boolean } = {},
): Promise<EpisodeDownloadResult> {
  const { stream, playlist } = await pickStream(target, signal);
  if (playlist.segments.length === 0) {
    throw new SourceError("El playlist no tiene segmentos", "VIDEO_ERROR");
  }

  // The folder takes the language the caller asked for, which is the same value
  // the entry key is built from. Falling back to another language here left the
  // key, the folder and the delete path pointing at different places.
  const language = target.language ?? null;
  const dir = episodeDirectory(target.slug, target.number, language);
  // A folder without the marker holds segments from the older format, where the
  // downloader wrote them decrypted: mixing those with encrypted ones and a key
  // line would hand the player garbage
  const marker = new File(dir, FORMAT_MARKER);
  if (options.resume !== true || (dir.exists && !marker.exists)) {
    deleteEpisodeDownload(target.slug, target.number, language);
  }
  dir.create({ intermediates: true, idempotent: true });
  await marker.write(FORMAT_VERSION);

  const init = playlist.initSegment != null
    ? await downloadInit(playlist.initSegment, dir, stream.headers, signal)
    : null;

  const segmentsTotal = playlist.segments.length + (init != null ? 1 : 0);
  let segmentsDone = init != null ? 1 : 0;
  let bytesDone = init?.bytes ?? 0;
  // How many segments in flight is the host's answer, not a global choice
  const concurrency = segmentConcurrency(playlist.segments.map((segment) => segment.uri));
  logger.debug("download", `${target.slug} ep ${target.number}: ${segmentsTotal} segments queued, ${concurrency} workers`);
  onProgress({ segmentsDone, segmentsTotal, bytesDone });

  // Rotation keys are fetched once even when several segments need them, and
  // land next to the segments so the local playlist can point at them
  const keyRequests = new Map<string, Promise<Uint8Array>>();
  const getKey = (uri: string): Promise<Uint8Array> => {
    let request = keyRequests.get(uri);
    if (request == null) {
      request = fetchBytes(uri, stream.headers, signal).then((bytes) => {
        if (bytes.length !== 16) throw new SourceError("Clave AES-128 inválida", "VIDEO_ERROR");
        return bytes;
      });
      keyRequests.set(uri, request);
    }
    return request;
  };
  const keyFiles = new Map<string, string>();
  for (const segment of playlist.segments) {
    const keyUri = segment.key?.uri;
    if (keyUri == null || keyFiles.has(keyUri)) continue;
    const name = `key_${keyFiles.size}.bin`;
    await new File(dir, name).write(await getKey(keyUri));
    keyFiles.set(keyUri, name);
  }

  // Segments are independent files: several requests in flight keep a fast
  // link busy, which a strict one-at-a-time loop never does.
  let nextIndex = 0;
  let failure: unknown = null;
  const stats: SegmentStats = { count: 0, downloadMs: 0, downloadBytes: 0, writeMs: 0 };
  const worker = async (): Promise<void> => {
    while (failure == null && !signal.aborted) {
      const index = nextIndex++;
      const segment = playlist.segments[index];
      if (segment == null) return;
      // Yields between segments so renders and touches get their turn instead
      // of queueing behind the request loop
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const bytes = await downloadSegment(segment, index, dir, stream.headers, signal, stats);
        segmentsDone += 1;
        bytesDone += bytes;
        onProgress({ segmentsDone, segmentsTotal, bytesDone });
        // One line per 25 iterations, not per download: a resumed run skips
        // segments and would otherwise stay silent for minutes
        if (index === 0 || index % 25 === 0) {
          // Which phase is eating the wall clock, and whether the CDN caps the
          // rate per connection (throughput low) or per request (latency high)
          const perSegment = Math.max(1, stats.count);
          const megabytes = stats.downloadBytes / perSegment / 1_048_576;
          const rate = stats.downloadMs > 0 ? (stats.downloadBytes / 1_048_576) / (stats.downloadMs / 1000) : 0;
          logger.debug(
            "download",
            `${index + 1}/${segmentsTotal} (${segmentsDone} written), per segment: network ${Math.round(stats.downloadMs / perSegment)}ms, write ${Math.round(stats.writeMs / perSegment)}ms, ${megabytes.toFixed(2)}MB at ${rate.toFixed(2)}MB/s`,
          );
        }
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, playlist.segments.length) }, worker),
  );
  if (failure != null) throw failure;
  if (signal.aborted) throw new SourceError("Descarga cancelada", "NETWORK_ERROR");

  const localSegments = playlist.segments.map((segment, index) => ({
    duration: segment.duration,
    file: segmentFileName(index, segment.uri),
    // The local playlist renumbers the sequence, so the IV has to be explicit
    keyFile: segment.key != null ? keyFiles.get(segment.key.uri) ?? null : null,
    iv: segment.key != null ? segment.key.iv ?? sequenceIv(segment.sequence) : null,
  }));

  const playlistFile = new File(dir, PLAYLIST_FILE);
  await playlistFile.write(
    buildLocalPlaylist({
      targetDuration: playlist.targetDuration,
      segments: localSegments,
      initFile: init?.file ?? null,
    }),
  );

  logger.info("download", `Saved ${target.slug} ep ${target.number} (${segmentsTotal} segments)`);

  return {
    dirUri: dir.uri,
    playlistUri: playlistFile.uri,
    bytes: bytesDone,
    segmentsTotal,
  };
}

export function toDownloadError(error: unknown): AppError {
  if (error instanceof SourceError) return { type: error.type, message: error.message };
  return { type: "UNKNOWN", message: error instanceof Error ? error.message : "Error de descarga" };
}
