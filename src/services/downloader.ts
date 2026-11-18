import { Directory, File, Paths } from "expo-file-system";
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

export const DOWNLOADS_DIR = "downloads";
export const PLAYLIST_FILE = "index.m3u8";

export interface EpisodeTarget {
  slug: string;
  number: string;
  /** Preferred server language; falls back to the first server. */
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
  language: string;
  bytes: number;
  segmentsTotal: number;
}

export function episodeDirectory(slug: string, number: string): Directory {
  return new Directory(Paths.document, DOWNLOADS_DIR, slug, `ep-${number}`);
}

export function episodePlaylist(slug: string, number: string): File {
  return new File(episodeDirectory(slug, number), PLAYLIST_FILE);
}

export function isEpisodeDownloaded(slug: string, number: string): boolean {
  return episodePlaylist(slug, number).exists;
}

export function deleteEpisodeDownload(slug: string, number: string): void {
  const dir = episodeDirectory(slug, number);
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

function rangeHeaders(range: { length: number; offset: number } | null): Record<string, string> {
  if (range == null) return {};
  return { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` };
}

async function downloadTo(
  url: string,
  target: File,
  headers: Record<string, string>,
  signal: AbortSignal,
  range: { length: number; offset: number } | null = null,
): Promise<void> {
  await File.downloadFileAsync(url, target, {
    idempotent: true,
    headers: { ...headers, ...rangeHeaders(range) },
    signal,
  });
}

async function fetchText(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new SourceError(`HTTP ${res.status} al descargar el playlist`, "VIDEO_ERROR");
  return res.text();
}

async function fetchBytes(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new SourceError(`HTTP ${res.status} al descargar la clave`, "VIDEO_ERROR");
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

async function pickStream(target: EpisodeTarget): Promise<{ url: string; headers: Record<string, string>; language: string }> {
  const servers = await source.getEpisodeServers(target.slug, target.number);
  if (servers.length === 0) throw new SourceError("No hay servidor disponible", "VIDEO_ERROR");
  const server =
    (target.language != null ? servers.find((s) => s.language === target.language) : null) ?? servers[0];
  if (server == null) throw new SourceError("No hay servidor disponible", "VIDEO_ERROR");

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
  keyCache: Map<string, Uint8Array>,
  signal: AbortSignal,
): Promise<{ file: string; bytes: number }> {
  const name = `seg_${String(index).padStart(5, "0")}${extensionOf(segment.uri, ".ts")}`;
  const file = new File(dir, name);

  // A file from an interrupted run is kept: resuming skips what is already there
  if (file.exists && file.size > 0) {
    return { file: name, bytes: file.size };
  }

  // Landing in a .part file keeps a half-written or still-encrypted segment
  // from ever looking complete to the resume check
  const part = new File(dir, `${name}.part`);
  await downloadTo(segment.uri, part, headers, signal, segment.range);

  const key = segment.key;
  if (key != null) {
    let keyBytes = keyCache.get(key.uri);
    if (keyBytes == null) {
      keyBytes = await fetchBytes(key.uri, headers, signal);
      if (keyBytes.length !== 16) throw new SourceError("Clave AES-128 inválida", "VIDEO_ERROR");
      keyCache.set(key.uri, keyBytes);
    }
    const iv = key.iv ?? sequenceIv(segment.sequence);
    const plain = decryptSegment(await part.bytes(), keyBytes, iv);
    await file.write(plain);
    part.delete();
  } else {
    await part.move(file);
  }

  return { file: name, bytes: file.size };
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
): Promise<EpisodeDownloadResult> {
  const stream = await pickStream(target);
  logger.info("download", `Resolving playlist for ${target.slug} ep ${target.number}`);
  const body = await fetchText(stream.url, stream.headers, signal);
  const playlist = parseMediaPlaylist(body, stream.url);
  if (playlist.segments.length === 0) {
    throw new SourceError("El playlist no tiene segmentos", "VIDEO_ERROR");
  }

  const dir = episodeDirectory(target.slug, target.number);
  dir.create({ intermediates: true, idempotent: true });

  const init = playlist.initSegment != null
    ? await downloadInit(playlist.initSegment, dir, stream.headers, signal)
    : null;

  const segmentsTotal = playlist.segments.length + (init != null ? 1 : 0);
  let segmentsDone = init != null ? 1 : 0;
  let bytesDone = init?.bytes ?? 0;
  onProgress({ segmentsDone, segmentsTotal, bytesDone });

  const keyCache = new Map<string, Uint8Array>();
  const localSegments: { duration: number; file: string }[] = [];

  for (const [index, segment] of playlist.segments.entries()) {
    if (signal.aborted) throw new SourceError("Descarga cancelada", "NETWORK_ERROR");
    const result = await downloadSegment(segment, index, dir, stream.headers, keyCache, signal);
    localSegments.push({ duration: segment.duration, file: result.file });
    segmentsDone += 1;
    bytesDone += result.bytes;
    onProgress({ segmentsDone, segmentsTotal, bytesDone });
  }

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
    language: stream.language,
    bytes: bytesDone,
    segmentsTotal,
  };
}

export function toDownloadError(error: unknown): AppError {
  if (error instanceof SourceError) return { type: error.type, message: error.message };
  return { type: "UNKNOWN", message: error instanceof Error ? error.message : "Error de descarga" };
}
