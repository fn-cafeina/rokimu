/**
 * GitHub allows 60 unauthenticated requests per hour and a conditional request
 * answered with 304 costs none, so one check per window stays far below it.
 */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** The last answer from the releases API, kept across launches. */
export interface StoredCheck {
  /** When the API last answered: the throttle anchor. */
  checkedAt: number;
  /** Validator for the next request, so an unchanged release answers 304. */
  etag: string | null;
  /** Release version without the leading v, prerelease suffix included. */
  tag: string | null;
  apkUrl: string | null;
}

export const EMPTY_CHECK: StoredCheck = {
  checkedAt: 0,
  etag: null,
  tag: null,
  apkUrl: null,
};

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Anything unreadable falls back to a full check, never to a stale update. */
export function parseStoredCheck(raw: unknown): StoredCheck | null {
  if (typeof raw !== "object" || raw == null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.checkedAt !== "number" || !Number.isFinite(record.checkedAt)) return null;
  if (!isStringOrNull(record.etag) || !isStringOrNull(record.tag) || !isStringOrNull(record.apkUrl)) {
    return null;
  }
  return { checkedAt: record.checkedAt, etag: record.etag, tag: record.tag, apkUrl: record.apkUrl };
}

/** Whether the throttle window has elapsed since the last API round trip. */
export function shouldCheck(checkedAt: number, now: number): boolean {
  return checkedAt <= 0 || now - checkedAt >= CHECK_INTERVAL_MS;
}

export interface UpdateCheckData {
  updateAvailable: string | null;
  apkUrl: string | null;
}

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

export function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const a = l[i] ?? 0;
    const b = c[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

/** Release held from the last answer, when it beats the installed version. */
export function dataFromStored(value: StoredCheck, current: string): UpdateCheckData | null {
  if (value.tag == null || value.apkUrl == null) return null;
  // Prereleases and downgrades never reach the user
  if (value.tag.includes("-") || !isNewer(value.tag, current)) return null;
  return { updateAvailable: value.tag, apkUrl: value.apkUrl };
}
