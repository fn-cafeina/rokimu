import { Directory, File, Paths } from "expo-file-system";
import { TIMEOUTS } from "../config/cache";
import type { AppError } from "../types";
import { SourceError } from "../utils/errors";
import { logger } from "../utils/logger";
import { source } from "./source";
import {
  buildLocalPlaylist,
  decryptSegment,
  parseMediaPlaylist,
  sequenceIv,
  type HlsInitSegment,
  type HlsSegment,
} from "./hls";

// A single segment request at a time leaves a fast wifi link idle
const SEGMENT_CONCURRENCY = 8;
// A transfer that stops moving is aborted: a dead socket otherwise holds one
// worker forever and, with concurrency 1, the whole queue behind it
const STALL_TIMEOUT_MS = 45_000;

export const DOWNLOADS_DIR = "downloads";
export const PLAYLIST_FILE = "index.m3u8";

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
  /** Folder language: the requested one, so the entry key and the disk agree. */
  language: string | null;
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

async function downloadTo(
  url: string,
  target: File,
  headers: Record<string, string>,
  signal: AbortSignal,
  range: { length: number; offset: number } | null = null,
): Promise<void> {
  const guard = guardRequest(signal, STALL_TIMEOUT_MS);
  try {
    await File.downloadFileAsync(url, target, {
      idempotent: true,
      headers: { ...headers, ...rangeHeaders(range) },
      signal: guard.signal,
      onProgress: () => guard.touch(),
    });
  } catch (error) {
    throw settleRequestError(error, signal);
  } finally {
    guard.release();
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

async function pickStream(target: EpisodeTarget): Promise<{ url: string; headers: Record<string, string>; language: string }> {
  const servers = await source.getEpisodeServers(target.slug, target.number);
  if (servers.length === 0) throw new SourceError("No hay servidor disponible", "VIDEO_ERROR");
  // A requested language is not negotiable: downloading another audio track
  // under that label would be a silent lie to the user
  const server = target.language != null ? servers.find((s) => s.language === target.language) : servers[0];
  if (server == null) {
    throw new SourceError(`No hay servidor en ${target.language} para este episodio`, "VIDEO_ERROR");
  }

  const stream = await source.resolveStreamUrl(server.url);
  if (stream == null) throw new SourceError("No se pudo resolver el stream", "VIDEO_ERROR");
  return { url: stream.url, headers: stream.headers ?? {}, language: server.language };
}

async function downloadInit(
  init: HlsInitSegment,
  dir: Directory,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ file: string; bytes: number }> {
  const name = `init${extensionOf(init.uri, ".mp4")}`;
  const file = new File(dir, name);
  if (!(file.exists && file.size > 0)) {
    await downloadTo(init.uri, file, headers, signal, init.range);
  }
  return { file: name, bytes: file.size };
}

async function downloadSegment(
  segment: HlsSegment,
  index: number,
  dir: Directory,
  headers: Record<string, string>,
  getKey: (uri: string) => Promise<Uint8Array>,
  signal: AbortSignal,
): Promise<number> {
  const name = segmentFileName(index, segment.uri);
  const file = new File(dir, name);

  // A file from an interrupted run is kept: resuming skips what is already there
  if (file.exists && file.size > 0) {
    return file.size;
  }

  // Landing in a .part file keeps a half-written or still-encrypted segment
  // from ever looking complete to the resume check
  const part = new File(dir, `${name}.part`);
  await downloadTo(segment.uri, part, headers, signal, segment.range);

  const key = segment.key;
  if (key != null) {
    const keyBytes = await getKey(key.uri);
    const iv = key.iv ?? sequenceIv(segment.sequence);
    const plain = decryptSegment(await part.bytes(), keyBytes, iv);
    await file.write(plain);
    part.delete();
  } else {
    await part.move(file);
  }

  return file.size;
}

/**
 * Downloads one episode as a self-contained HLS folder: init segment,
 * decrypted segments and a rewritten playlist pointing at local file names.
 * ExoPlayer then plays the folder offline through `expo-video`.
 */
export async function downloadEpisode(
  target: EpisodeTarget,
  onProgress: (progress: EpisodeDownloadProgress) => void,
  signal: AbortSignal,
  options: { resume?: boolean } = {},
): Promise<EpisodeDownloadResult> {
  const stream = await pickStream(target);
  logger.info("download", `Resolving playlist for ${target.slug} ep ${target.number}`);
  const body = await fetchText(stream.url, stream.headers, signal);
  const playlist = parseMediaPlaylist(body, stream.url);
  if (playlist.segments.length === 0) {
    throw new SourceError("El playlist no tiene segmentos", "VIDEO_ERROR");
  }

  // The folder takes the language the caller asked for, which is the same value
  // the entry key is built from. Falling back to another language here left the
  // key, the folder and the delete path pointing at different places.
  const language = target.language ?? null;
  const dir = episodeDirectory(target.slug, target.number, language);
  // Only an interrupted run resumes. Anything else starts from an empty folder,
  // so segments from a dead attempt can never mix into the new playlist.
  if (options.resume !== true) deleteEpisodeDownload(target.slug, target.number, language);
  dir.create({ intermediates: true, idempotent: true });

  const init = playlist.initSegment != null
    ? await downloadInit(playlist.initSegment, dir, stream.headers, signal)
    : null;

  const segmentsTotal = playlist.segments.length + (init != null ? 1 : 0);
  let segmentsDone = init != null ? 1 : 0;
  let bytesDone = init?.bytes ?? 0;
  onProgress({ segmentsDone, segmentsTotal, bytesDone });

  // Rotation keys are fetched once even when several segments need them
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

  // Segments are independent files: several requests in flight keep a fast
  // link busy, which a strict one-at-a-time loop never does.
  let nextIndex = 0;
  let failure: unknown = null;
  const worker = async (): Promise<void> => {
    while (failure == null && !signal.aborted) {
      const index = nextIndex++;
      const segment = playlist.segments[index];
      if (segment == null) return;
      try {
        const bytes = await downloadSegment(segment, index, dir, stream.headers, getKey, signal);
        segmentsDone += 1;
        bytesDone += bytes;
        onProgress({ segmentsDone, segmentsTotal, bytesDone });
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(SEGMENT_CONCURRENCY, playlist.segments.length) }, worker),
  );
  if (failure != null) throw failure;
  if (signal.aborted) throw new SourceError("Descarga cancelada", "NETWORK_ERROR");

  const localSegments = playlist.segments.map((segment, index) => ({
    duration: segment.duration,
    file: segmentFileName(index, segment.uri),
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
    language,
    bytes: bytesDone,
    segmentsTotal,
  };
}

export function toDownloadError(error: unknown): AppError {
  if (error instanceof SourceError) return { type: error.type, message: error.message };
  return { type: "UNKNOWN", message: error instanceof Error ? error.message : "Error de descarga" };
}
