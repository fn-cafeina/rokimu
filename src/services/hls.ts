import { SourceError } from "@/utils/errors";

interface ByteRange {
  length: number;
  offset: number;
}

/** AES-128 is the only HLS encryption a local download can undo. */
interface HlsKey {
  uri: string;
  iv: Uint8Array | null;
}

export interface HlsInitSegment {
  uri: string;
  range: ByteRange | null;
}

export interface HlsSegment {
  uri: string;
  duration: number;
  /** Media sequence number, the default IV source when the key has none. */
  sequence: number;
  key: HlsKey | null;
  range: ByteRange | null;
}

export interface HlsMediaPlaylist {
  targetDuration: number;
  mediaSequence: number;
  segments: HlsSegment[];
  initSegment: HlsInitSegment | null;
}

function parseAttributes(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  let current = "";
  let quoted = false;

  const push = (chunk: string) => {
    const eq = chunk.indexOf("=");
    if (eq < 0) return;
    const key = chunk.slice(0, eq).trim();
    const value = chunk.slice(eq + 1).trim();
    result[key] = value.startsWith('"') && value.endsWith('"') && value.length >= 2
      ? value.slice(1, -1)
      : value;
  };

  for (const char of input) {
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      push(current);
      current = "";
      continue;
    }
    current += char;
  }
  push(current);
  return result;
}

function parseHex(value: string): Uint8Array {
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function parseByteRange(value: string, previousEnd: number): ByteRange {
  const [lengthPart, offsetPart] = value.split("@");
  const length = parseInt(lengthPart ?? "", 10);
  if (!Number.isFinite(length) || length <= 0) {
    throw new SourceError(`Byte range inválido: ${value}`, "PARSER_ERROR");
  }
  const offset = offsetPart != null && offsetPart !== "" ? parseInt(offsetPart, 10) : previousEnd;
  if (!Number.isFinite(offset) || offset < 0) {
    throw new SourceError(`Byte range inválido: ${value}`, "PARSER_ERROR");
  }
  return { length, offset };
}

function resolveUri(uri: string, baseUrl: string): string {
  try {
    return new URL(uri, baseUrl).href;
  } catch {
    return uri;
  }
}

function parseKey(value: string, baseUrl: string): HlsKey | null {
  const attrs = parseAttributes(value);
  const method = attrs.METHOD ?? "";
  if (method === "NONE") return null;
  if (method !== "AES-128") {
    throw new SourceError(`Cifrado HLS no soportado: ${method}`, "VIDEO_ERROR");
  }
  if (attrs.URI == null || attrs.URI === "") {
    throw new SourceError("Clave HLS sin URI", "PARSER_ERROR");
  }
  return {
    uri: resolveUri(attrs.URI, baseUrl),
    iv: attrs.IV != null && attrs.IV !== "" ? parseHex(attrs.IV) : null,
  };
}

function parseMap(value: string, baseUrl: string): HlsInitSegment {
  const attrs = parseAttributes(value);
  if (attrs.URI == null || attrs.URI === "") {
    throw new SourceError("Segmento init sin URI", "PARSER_ERROR");
  }
  return {
    uri: resolveUri(attrs.URI, baseUrl),
    range: attrs.BYTERANGE != null && attrs.BYTERANGE !== "" ? parseByteRange(attrs.BYTERANGE, 0) : null,
  };
}

/**
 * Media playlist only. The bridge resolver already picked a variant, so the
 * downloader always lands on a playlist with segments.
 */
export function parseMediaPlaylist(body: string, baseUrl: string): HlsMediaPlaylist {
  const segments: HlsSegment[] = [];
  let targetDuration = 0;
  let mediaSequence = 0;
  let currentKey: HlsKey | null = null;
  let currentMap: HlsInitSegment | null = null;
  let initUri: string | null = null;
  let currentDuration: number | null = null;
  let currentRange: ByteRange | null = null;
  let mapRangeEnd = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;

    if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      targetDuration = parseInt(line.slice("#EXT-X-TARGETDURATION:".length), 10) || 0;
      continue;
    }
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) {
      mediaSequence = parseInt(line.slice("#EXT-X-MEDIA-SEQUENCE:".length), 10) || 0;
      continue;
    }
    if (line.startsWith("#EXT-X-KEY:")) {
      currentKey = parseKey(line.slice("#EXT-X-KEY:".length), baseUrl);
      continue;
    }
    if (line.startsWith("#EXT-X-MAP:")) {
      const map = parseMap(line.slice("#EXT-X-MAP:".length), baseUrl);
      // One local playlist can carry one init segment. A second one starts a
      // decode chain the downloader cannot describe, and pointing every segment
      // at the last init plays garbage instead of failing.
      if (initUri != null && initUri !== map.uri) {
        throw new SourceError("Playlist con más de un segmento init", "VIDEO_ERROR");
      }
      initUri = map.uri;
      currentMap = map;
      continue;
    }
    if (line.startsWith("#EXT-X-BYTERANGE:")) {
      currentRange = parseByteRange(line.slice("#EXT-X-BYTERANGE:".length), mapRangeEnd);
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      const duration = parseFloat(line.slice("#EXTINF:".length).split(",")[0] ?? "");
      currentDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      continue;
    }
    if (line.startsWith("#")) continue;

    if (currentDuration == null) continue;

    const sequence = mediaSequence + segments.length;
    // A byterange without offset starts where the previous one ended
    const range = currentRange;
    if (range != null) mapRangeEnd = range.offset + range.length;

    segments.push({
      uri: resolveUri(line, baseUrl),
      duration: currentDuration,
      sequence,
      key: currentKey,
      range,
    });
    currentDuration = null;
    currentRange = null;
  }

  return {
    targetDuration: targetDuration > 0 ? targetDuration : Math.ceil(Math.max(0, ...segments.map((s) => s.duration))),
    mediaSequence,
    segments,
    initSegment: currentMap,
  };
}

/** 16-byte big-endian IV derived from the media sequence number, per RFC 8216. */
export function sequenceIv(sequence: number): Uint8Array {
  const iv = new Uint8Array(16);
  let remaining = sequence;
  for (let i = 15; i >= 0 && remaining > 0; i--) {
    iv[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return iv;
}

interface LocalPlaylistSegment {
  duration: number;
  file: string;
  /** Local key file when the segment is still AES-128 encrypted on disk */
  keyFile?: string | null;
  /** Explicit IV: the local playlist renumbers the media sequence from 0 */
  iv?: Uint8Array | null;
}

function hexIv(iv: Uint8Array): string {
  return Array.from(iv, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Rewrites the playlist against local file names, with nothing left to fetch.
 * Encrypted segments keep their key, so the player decrypts natively instead of
 * the downloader decrypting in JS and copying megabytes through the bridge.
 */
export function buildLocalPlaylist(input: {
  targetDuration: number;
  segments: LocalPlaylistSegment[];
  initFile?: string | null;
}): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${Math.max(1, Math.ceil(input.targetDuration))}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
  ];
  if (input.initFile != null) lines.push(`#EXT-X-MAP:URI="${input.initFile}"`);
  let encrypted = false;
  for (const segment of input.segments) {
    if (segment.keyFile != null) {
      const iv = segment.iv ?? new Uint8Array(16);
      lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="${segment.keyFile}",IV=0x${hexIv(iv)}`);
      encrypted = true;
    } else if (encrypted) {
      lines.push("#EXT-X-KEY:METHOD=NONE");
      encrypted = false;
    }
    lines.push(`#EXTINF:${segment.duration},`, segment.file);
  }
  lines.push("#EXT-X-ENDLIST", "");
  return lines.join("\n");
}
