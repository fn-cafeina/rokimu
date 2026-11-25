import { TIMEOUTS } from "@/config/cache";
import { SourceError, isCancelled } from "@/utils/errors";
import { withTimeout } from "@/utils/withTimeout";

const RELEASES_URL = "https://api.github.com/repos/fn-cafeina/rokimu/releases/latest";
/** Anything smaller is a placeholder, not an installable build. */
const MIN_APK_BYTES = 5 * 1024 * 1024;

export interface LatestRelease {
  /** The stored tag is still the latest: the answer cost no rate limit. */
  notModified: boolean;
  /** Release tag without the leading `v`; null when the release carries none. */
  tag: string | null;
  /** Null when the release ships no usable APK asset. */
  apkUrl: string | null;
  etag: string | null;
}

/**
 * GitHub allows 60 unauthenticated requests per hour and a conditional request
 * answered with 304 costs none, so the ETag is what keeps the check free.
 */
export async function fetchLatestRelease(input: {
  etag: string | null;
  signal: AbortSignal;
}): Promise<LatestRelease> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Rokimu-Android",
  };
  // An unchanged release answers 304, which costs no rate limit
  if (input.etag != null) headers["If-None-Match"] = input.etag;

  let res: Response;
  // One helper owns the deadline: a stall here is a timeout the check can
  // report, not a cancellation that leaves the row stuck on "Buscando..."
  try {
    res = await withTimeout(
      input.signal,
      TIMEOUTS.UPDATE_CHECK,
      (requestSignal) => fetch(RELEASES_URL, { headers, signal: requestSignal }),
      "Se agotó el tiempo de búsqueda",
    );
  } catch (err) {
    if (err instanceof SourceError || isCancelled(err)) throw err;
    throw new SourceError("Error al buscar actualizaciones", "NETWORK_ERROR");
  }

  if (res.status === 304) {
    return { notModified: true, tag: null, apkUrl: null, etag: input.etag };
  }
  if (res.status === 404) {
    return { notModified: false, tag: null, apkUrl: null, etag: null };
  }
  if (!res.ok) throw new SourceError("Error al buscar actualizaciones", "NETWORK_ERROR");

  const data = (await res.json()) as {
    tag_name?: string;
    assets?: { name: string; browser_download_url: string; size?: number }[];
  };
  const tag = (data.tag_name ?? "").replace(/^v/, "").trim();
  if (!tag) throw new SourceError("Error al buscar actualizaciones", "UNKNOWN");

  const apkAsset = data.assets?.find(
    (asset) =>
      asset.name.toLowerCase().startsWith("rokimu-") &&
      asset.name.toLowerCase().endsWith(".apk") &&
      (asset.size == null || asset.size > MIN_APK_BYTES),
  );

  return {
    notModified: false,
    tag,
    apkUrl: apkAsset?.browser_download_url ?? null,
    etag: res.headers.get("etag"),
  };
}
