import { gcm } from "@noble/ciphers/aes.js";
import { bytesToUtf8 } from "@noble/ciphers/utils.js";
import { SourceError, isCancelled } from "@/utils/errors";
import { SOURCE_CONFIG } from "@/config/source";

interface PlaybackData {
  algorithm: string;
  iv: string;
  payload: string;
  key_parts: string[];
  version: string;
}

interface VideoSource {
  url?: string;
  file?: string;
}

interface DecryptedData {
  sources: VideoSource[];
}

interface HlsStream {
  quality: string;
  url: string;
}

interface ByseResult {
  url: string;
  headers: Record<string, string>;
}

function selectIndexes(version: string): [number, number] | null {
  const n = parseInt(version, 10);
  if (isNaN(n) || n < 1 || n > 20) return null;
  return [n, 31 - n];
}

export function selectKeyParts(data: PlaybackData): string[] {
  const idx = selectIndexes(data.version);
  if (!idx) return data.key_parts;
  const [a, b] = idx;
  if (a < 1 || b < 1 || a > data.key_parts.length || b > data.key_parts.length) {
    return data.key_parts;
  }
  const partA = data.key_parts[a - 1];
  const partB = data.key_parts[b - 1];
  const parts: string[] = [];
  if (partA != null) parts.push(partA);
  if (partB != null) parts.push(partB);
  return parts;
}

function b64url(input: string): Uint8Array {
  const binaryStr = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export function decrypt(data: PlaybackData): string {
  const keyParts = selectKeyParts(data);
  const keyBytes = new Uint8Array(keyParts.reduce((acc, p) => acc + b64url(p).length, 0));
  let offset = 0;
  for (const part of keyParts) {
    const partBytes = b64url(part);
    keyBytes.set(partBytes, offset);
    offset += partBytes.length;
  }

  const iv = b64url(data.iv);
  const payload = b64url(data.payload);
  const tag = payload.subarray(-16);
  const ct = payload.subarray(0, -16);

  const fullCt = new Uint8Array(ct.length + tag.length);
  fullCt.set(ct, 0);
  fullCt.set(tag, ct.length);

  const cipher = gcm(keyBytes, iv);
  const decrypted = cipher.decrypt(fullCt);
  return bytesToUtf8(decrypted);
}

function parseMaster(body: string, baseUrl: string): HlsStream[] {
  const result: HlsStream[] = [];
  let info: { height: number; bw: number } | null = null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#EXT-X-STREAM-INF:")) {
      const h = t.match(/RESOLUTION=(\d+)x(\d+)/);
      const b = t.match(/BANDWIDTH=(\d+)/);
      info = { height: h ? parseInt(h[2]!) : 0, bw: b ? parseInt(b[1]!) : 0 };
    } else if (t && !t.startsWith("#") && info) {
      const url = t.startsWith("http") ? t : new URL(t, baseUrl).href;
      result.push({ quality: info.height ? `${info.height}p` : `bw-${info.bw}`, url });
      info = null;
    }
  }
  return result;
}

function bestStream(streams: HlsStream[]): HlsStream | null {
  if (streams.length === 0) return null;
  return streams.reduce((best, s) => {
    const bestH = parseInt(best.quality, 10) || 0;
    const curH = parseInt(s.quality, 10) || 0;
    return curH > bestH ? s : best;
  });
}

/**
 * Dean Edwards packer: eval(function(p,a,c,k,e,d){...}('payload', radix,
 * count, 'k|k|...'.split('|'), 0, {})). The LuluStream player page hides its
 * jwplayer sources inside one of these.
 */
/**
 * Dean Edwards packer: eval(function(p,a,c,k,e,d){...}('payload', radix,
 * count, 'k|k|...'.split('|'), 0, {})). The LuluStream player page hides its
 * jwplayer sources inside one of these.
 *
 * shortcut: the canonical packer shape only, base up to 36, word-boundary
 * replacement; a page packing with the ``e`` decoder (base 62/64) unpacks to
 * empty, which surfaces as a parser error. Upgrade when a Lulu page stops
 * resolving.
 */
export function unpackPacked(page: string): string {
  const start = page.search(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)/);
  if (start < 0) return "";
  const argsMatch = /\}\s*\(/.exec(page.slice(start));
  if (argsMatch == null) return "";
  const argsStart = start + argsMatch.index;
  let i = argsStart + 2;
  const args: (string | number)[] = [];
  while (i < page.length && args.length < 4) {
    const ch = page[i];
    if (ch === " " || ch === ",") {
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      let value = "";
      i++;
      while (i < page.length) {
        const c = page[i];
        if (c === "\\") {
          value += page[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (c === q) {
          i++;
          break;
        }
        value += c;
        i++;
      }
      args.push(value);
      continue;
    }
    let digits = "";
    while (i < page.length && /[0-9]/.test(page[i]!)) {
      digits += page[i];
      i++;
    }
    if (digits !== "") args.push(parseInt(digits, 10));
    else i++;
  }
  const [code, radix, count, wordList] = args as [string, number, number, string];
  if (typeof code !== "string" || typeof wordList !== "string") return "";
  // Past base 36 the digit alphabet carries RegExp metacharacters, so the
  // replacement below would rewrite the wrong text instead of failing
  if (typeof radix !== "number" || radix < 2 || radix > 36) return "";
  const words = wordList.split("|");
  const last = Math.min(typeof count === "number" ? count : words.length, words.length);
  let packed = code;
  for (let n = last - 1; n >= 0; n--) {
    const word = words[n];
    if (word) packed = packed.replace(new RegExp(`\\b${n.toString(radix)}\\b`, "g"), word);
  }
  return packed;
}

/**
 * LuluStream (Epsilon): the iframe page is a jwplayer embed whose sources
 * live inside a packed script; the source URL is a plain master playlist on
 * their CDN that answers 302 without the player's UA and Referer.
 */
async function extractLuluStream(
  iframeUrl: string,
  options?: { signal?: AbortSignal; userAgent?: string },
): Promise<ByseResult | null> {
  const ua = options?.userAgent ?? "";
  const page = await fetch(iframeUrl, {
    headers: { "User-Agent": ua, Referer: `${SOURCE_CONFIG.baseUrl}/` },
    signal: options?.signal,
  }).then((r) => {
    if (!r.ok) throw new SourceError(`Lulu page HTTP ${r.status}`, "VIDEO_ERROR");
    return r.text();
  });

  const source = unpackPacked(page).match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+)"/)?.[1];
  if (source == null) throw new SourceError("No source in Lulu player", "PARSER_ERROR");

  const headers = { "User-Agent": ua, Accept: "*/*", Referer: "https://lplaygo.com/" };
  const master = await fetch(source, { headers, signal: options?.signal }).then((r) => {
    if (!r.ok) throw new SourceError(`Master playlist HTTP ${r.status}`, "VIDEO_ERROR");
    return r.text();
  });

  const best = bestStream(parseMaster(master, source));
  if (!best) return null;
  return { url: best.url, headers };
}

export async function extractBest(
  iframeUrl: string,
  options?: { signal?: AbortSignal; userAgent?: string },
): Promise<ByseResult | null> {
  const u = new URL(iframeUrl);
  const host = u.hostname;
  const id = u.pathname.split("/").filter(Boolean).pop();
  if (id == null) return null;

  // Epsilon rides a LuluStream embed; only Delta speaks the Byse API
  if (host.includes("lplaygo")) {
    return extractLuluStream(iframeUrl, options);
  }

  const fetchHeaders: Record<string, string> = {
    "User-Agent": options?.userAgent ?? "",
    Accept: "application/json",
  };

  const apiUrl = `https://${host}/api/videos/${id}`;
  const raw = await fetch(apiUrl, { headers: fetchHeaders, signal: options?.signal });
  if (!raw.ok) throw new SourceError(`Byse API HTTP ${raw.status}`, "VIDEO_ERROR");

  let decrypted: DecryptedData;
  try {
    const videoData: { playback?: PlaybackData } = await raw.json();
    if (videoData.playback == null) throw new SourceError("No playback data from Byse API", "PARSER_ERROR");
    decrypted = JSON.parse(decrypt(videoData.playback)) as DecryptedData;
  } catch (e: unknown) {
    if (e instanceof SourceError || isCancelled(e)) throw e;
    throw new SourceError("Byse payload unreadable", "PARSER_ERROR");
  }
  if (decrypted.sources.length === 0) throw new SourceError("No sources in decrypted Byse data", "PARSER_ERROR");

  const ua = options?.userAgent ?? "";

  const allStreams: HlsStream[] = [];
  for (const src of decrypted.sources) {
    const su = src.url ?? src.file;
    if (su == null || su.length === 0) continue;

    const hlsBody = await fetch(su, {
      headers: { "User-Agent": ua, Referer: `https://${host}/`, Accept: "*/*" },
      signal: options?.signal,
    }).then((r) => {
      if (!r.ok) throw new SourceError(`Master playlist HTTP ${r.status}`, "VIDEO_ERROR");
      return r.text();
    });

    allStreams.push(...parseMaster(hlsBody, su));
  }

  const best = bestStream(allStreams);
  if (!best) return null;

  return {
    url: best.url,
    headers: { "User-Agent": ua, Accept: "*/*", Referer: `https://${host}/` },
  };
}
