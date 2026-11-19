import type { ISession } from "@/types";

const ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";

/** Only the source origin speaks for the session; every other host is a third party. */
export function isSourceUrl(url: string, baseUrl: string): boolean {
  try {
    // Origin equality, not a prefix: a host that merely starts with the base
    // URL (www.site.com.evil.host) is somebody else
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Request headers for the source and its partners. The cookie jar (its
 * cf_clearance included) belongs to the source origin: a foreign host that
 * received it could store it, and their own cf_clearance merging back would
 * break the session we send upstream.
 */
export function buildHeaders(input: {
  url: string;
  baseUrl: string;
  session: ISession | null;
  extra?: Record<string, string>;
}): Record<string, string> {
  const { url, baseUrl, session, extra } = input;
  const headers: Record<string, string> = {
    ...extra,
    "User-Agent": session?.userAgent ?? "",
    Accept: ACCEPT,
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    Connection: "keep-alive",
    // The bridge host (website.*) answers 403 to a bare request, so every host
    // gets the source origin as referrer; the session stays source-only
    Referer: `${baseUrl}/`,
  };

  if (!isSourceUrl(url, baseUrl)) return headers;

  headers.Cookie = session?.cookies ?? "";
  headers["Upgrade-Insecure-Requests"] = "1";
  headers["Sec-Fetch-Dest"] = "document";
  headers["Sec-Fetch-Mode"] = "navigate";
  headers["Sec-Fetch-Site"] = "same-origin";
  headers["Sec-Fetch-User"] = "?1";
  return headers;
}
