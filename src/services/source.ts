import { TIMEOUTS } from "@/config/cache";
import { SOURCE_CONFIG, LANGUAGE_MAP } from "@/config/source";
import { logger } from "@/utils/logger";
import { SourceError } from "@/utils/errors";
import { backoffDelay } from "@/utils/math";
import { sessionManager } from "./session";
import { HtmlParser, cleanTitle, extractJson, isChallengeHtml } from "./parsers";
import { buildHeaders, isSourceUrl } from "./requestHeaders";
import { webViewBridge } from "./webview";
import { extractBest } from "./extractors";
import type {
  Anime,
  AnimeDetail,
  VideoServer,
  StreamUrlResult,
} from "@/types";


interface SessionResponse {
  ok: boolean;
  status: number;
  /** Body read under the same timeout as the request itself. */
  body: string;
}

async function fetchWithSession(path: string, options: RequestInit = {}): Promise<SessionResponse> {
  // The real response owns the verdict: stored cookies go out as-is, and a
  // 403/challenge below enters the wash-and-retry ladder
  const baseUrl = SOURCE_CONFIG.baseUrl;

  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  // Only the source origin speaks for the session: a rejection from a foreign
  // video host is that host's verdict, never grounds for a wash
  const isSourceOrigin = isSourceUrl(url, baseUrl);

  for (let attempt = 0; attempt < TIMEOUTS.MAX_ATTEMPTS; attempt++) {
    // Rebuilt per attempt: a Set-Cookie merge between attempts must reach the retry
    const session = await sessionManager.getSession();
    const headers = buildHeaders({
      url,
      baseUrl,
      session,
      extra: options.headers as Record<string, string>,
    });
    let timedOut = false;
    if (options.signal?.aborted) {
      // Navigation away or a newer request superseded this one: abort so
      // every store treats it as a silent cancellation, not a failure.
      const cancelled = new Error("Request cancelled");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUTS.REQUEST_TIMEOUT);
    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
    const hasMoreAttempts = attempt < TIMEOUTS.MAX_ATTEMPTS - 1;

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });

      const setCookies: string[] = [];
      res.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          setCookies.push(value);
        }
      });
      if (setCookies.length > 0 && isSourceOrigin) {
        await sessionManager.mergeSetCookies(setCookies);
      }

      // The body is read here, with the timer still armed: a host that sends
      // headers and then stops left every caller waiting forever
      const body = await res.text();

      if (!res.ok) {
        logger.info("fetch", `HTTP ${res.status} for ${url}`);

        if (res.status === 403 || res.status === 401) {
          if (isSourceOrigin) {
            logger.info("fetch", `Auth error ${res.status} detected, entering ladder`);
            throw new SourceError("Authentication failed - session invalid", "AUTH_ERROR");
          }
          logger.info("fetch", `Foreign host rejected with ${res.status}: ${url}`);
          throw new SourceError(`HTTP Error: ${res.status}`, "VIDEO_ERROR");
        }

        // Retry only transient statuses (5xx, 429); 4xx errors are final
        const retryable = res.status >= 500 || res.status === 429;
        if (retryable && hasMoreAttempts) {
          logger.info("fetch", `Retrying (${attempt + 1}/${TIMEOUTS.MAX_ATTEMPTS}) for HTTP ${res.status}: ${url}`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
          continue;
        }

        // Cloudflare challenges from the source origin arrive as non-ok HTML
        // pages; route them into the session refresh ladder instead of
        // reporting a network error. Foreign hosts run their own challenges
        // that our wash cannot clear, so they are not session failures.
        if (isSourceOrigin && isChallengeHtml(body)) {
          logger.info("fetch", `Challenge body on HTTP ${res.status}, entering ladder`);
          throw new SourceError("Challenge page — session invalid", "AUTH_ERROR");
        }
      }
      logger.debug("fetch", `OK ${res.status} for ${url}`);
      return { ok: res.ok, status: res.status, body };
    } catch (error) {
      if (error instanceof SourceError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        if (timedOut && !options.signal?.aborted) {
          logger.warn("fetch", `Timeout (${TIMEOUTS.REQUEST_TIMEOUT / 1000}s, attempt ${attempt + 1}/${TIMEOUTS.MAX_ATTEMPTS}) for ${url}`);
          if (hasMoreAttempts) {
            logger.info("fetch", `Retrying (${attempt + 1}/${TIMEOUTS.MAX_ATTEMPTS}) after timeout: ${url}`);
            await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
            continue;
          }
          throw new SourceError("Request timed out", "TIMEOUT");
        }
        throw error; // external abort: navigation away, not a failure
      }
      logger.warn("fetch", `Network error (attempt ${attempt + 1}/${TIMEOUTS.MAX_ATTEMPTS}) for ${url}`, error);
      if (hasMoreAttempts) {
        logger.info("fetch", `Retrying (${attempt + 1}/${TIMEOUTS.MAX_ATTEMPTS}) for network error: ${url}`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw new Error("Unreachable: MAX_ATTEMPTS is 0");
}

const htmlParser = new HtmlParser();

/**
 * Same verdict as fetchWithSession, executed by the worker's page instead of
 * the native client. The browser attaches the whole jar (HttpOnly included), so
 * there is nothing to transplant and no copy that can go stale.
 * Same-origin only: the page refuses a cross-origin fetch under CORS.
 */
export async function webviewFetch(path: string): Promise<SessionResponse> {
  const url = path.startsWith("http") ? path : `${SOURCE_CONFIG.baseUrl}${path}`;
  const result = await webViewBridge.fetchInPage(url);
  if (!result.ok) {
    throw new SourceError(`WebView request failed: ${result.error}`, result.error === "timeout" ? "TIMEOUT" : "NETWORK_ERROR");
  }
  if (isSourceUrl(url, SOURCE_CONFIG.baseUrl) && (result.status === 401 || result.status === 403 || isChallengeHtml(result.body))) {
    throw new SourceError("Authentication failed - session invalid", "AUTH_ERROR");
  }
  return { ok: result.status >= 200 && result.status < 300, status: result.status, body: result.body };
}

/**
 * One page of a card grid. `/directorio`, `/genero/<slug>` and `/anio/<year>`
 * all take `?page=N` and return 28 cards.
 */
async function getBrowsePage(path: string, page: number, options?: { signal?: AbortSignal }): Promise<Anime[]> {
  const endpoint = page > 1 ? `${path}?page=${page}` : path;
  const { ok, status, body: html } = await fetchWithSession(endpoint, options ?? {});
  if (!ok) throw new SourceError(`HTTP Error: ${status}`, "NETWORK_ERROR");
  const cards = htmlParser.parseCards(html);
  if (cards.length === 0) {
    if (isChallengeHtml(html)) throw new SourceError("Challenge page — session invalid", "AUTH_ERROR");
    // Page 1 of a real taxonomy is never empty; a later page is the end of the list
    if (page === 1) throw new SourceError("No cards extracted — site structure may have changed", "PARSER_ERROR");
  }
  return cards;
}

export interface RawSearchItem {
  name: string;
  slug: string;
  poster: string;
  type?: string;
}

// Raw search payload; the memory and storage caches both come from this one
// endpoint call per query
async function searchRaw(query: string, options?: { signal?: AbortSignal }): Promise<RawSearchItem[]> {
  const { ok, status, body: text } = await fetchWithSession(
    `/api/anime/search?q=${encodeURIComponent(query)}`,
    options ?? {},
  );
  if (!ok) throw new SourceError(`HTTP Error: ${status}`, "NETWORK_ERROR");
  let json: { data?: unknown };
  try {
    json = JSON.parse(text) as { data?: unknown };
  } catch {
    if (isChallengeHtml(text)) throw new SourceError("Challenge page — session invalid", "AUTH_ERROR");
    throw new SourceError(`Unexpected response format for query: ${query}`, "PARSER_ERROR");
  }
  const items = json.data ?? [];
  if (!Array.isArray(items)) throw new SourceError(`Unexpected response format for query: ${query}`, "PARSER_ERROR");
  return items as RawSearchItem[];
}

async function getDetails(slug: string, options?: { signal?: AbortSignal }): Promise<AnimeDetail | null> {
  const { ok, status, body: html } = await fetchWithSession(`/anime/${slug}`, options ?? {});
  if (status === 404) return null;
  if (!ok) throw new SourceError(`HTTP Error: ${status}`, "NETWORK_ERROR");
  const detail = parseAnimeDetail(html, slug);
  if (isChallengeHtml(html) || (!detail.title && !detail.image && !detail.synopsis)) {
    throw new SourceError("Challenge page — session invalid", "AUTH_ERROR");
  }
  return detail;
}

function parseAnimeDetail(html: string, slug: string): AnimeDetail {
  const meta = htmlParser.extractMetaTags(html);
  const rscData = htmlParser.parseAllFromScripts(html);

  const title = htmlParser.extractTitleFromHtml(html);
  const status = htmlParser.extractStatusFromHtml(html);
  const episodes = htmlParser.parseEpisodes(html, slug);

  const domSynopsis = htmlParser.extractSynopsisFromDom(html);
  const jsonLdSynopsis = htmlParser.extractSynopsisFromJsonLd(html);
  const jsonLdImage = htmlParser.extractImageFromJsonLd(html);
  const synopsis = rscData.synopsis ?? jsonLdSynopsis ?? domSynopsis ?? meta.description ?? "";

  const image = rscData.poster || (jsonLdImage ?? meta.banner ?? "");
  const genres = htmlParser.extractGenresFromJsonLd(html);

  return {
    // The h1 parser yields "" when it misses, so an empty string has to fall through
    title: cleanTitle(title !== "" ? title : (meta.title ?? "")),
    image,
    synopsis,
    banner: meta.banner ?? image,
    status,
    genres,
    episodes,
    relations: rscData.relations,
    url: slug,
  };
}

async function getEpisodeServers(slug: string, number: string, options?: { signal?: AbortSignal }): Promise<VideoServer[]> {
  const { ok, status, body: html } = await fetchWithSession(`/ver/${slug}/${number}`, options ?? {});
  if (!ok) throw new SourceError(`HTTP Error: ${status}`, "NETWORK_ERROR");
  // Challenges can arrive as HTTP 200; without this the parse below reports
  // "No Delta servers" and the real cause hides behind an UNKNOWN error
  if (isChallengeHtml(html)) throw new SourceError("Challenge page — session invalid", "AUTH_ERROR");

  const scripts = html.matchAll(/<script[^>]*>(.*?)<\/script>/gs);
  for (const match of scripts) {
    const text = match[1]!;
    if (!text.includes("self.__next_f.push")) continue;

    const p = htmlParser.parseRscPayload(text);
    if (!p || !p.includes('"players":')) continue;

    const j = extractJson(p, '"players":', "[", "]");
    if (!j) continue;

    try {
      const players = JSON.parse(j);
      const servers: VideoServer[] = [];

      for (const player of players) {
        // Delta and Epsilon share the Byse bridge shape; other servers stay out
        // until their bridge is understood
        if (player.server_name !== "Delta" && player.server_name !== "Epsilon") continue;

        servers.push({
          id: String(player.id),
          title: player.server_name,
          url: player.bridge_url,
          language: LANGUAGE_MAP[player.language] ?? player.language,
        });
      }

      return servers;
    } catch (e: unknown) {
      logger.warn("fetch", `JSON parse failed for ${slug} ep ${number}`, e);
    }
  }

  throw new SourceError(`No Delta/Epsilon servers extracted for ${slug} ep ${number}`, "PARSER_ERROR");
}

async function resolveStreamUrl(videoUrl: string, options?: { signal?: AbortSignal }): Promise<StreamUrlResult | null> {
  logger.debug("fetch", `Bridge URL: ${videoUrl.slice(0, 80)}`);

  logger.debug("fetch", "Fetching bridge page via fetchWithSession");
  const { ok, status, body: html } = await fetchWithSession(videoUrl, options ?? {});
  if (!ok) throw new SourceError(`HTTP Error: ${status}`, "VIDEO_ERROR");
  const m = html.match(/<iframe[^>]*src="([^"]+)"[^>]*>/);
  if (!m) throw new SourceError("No iframe in bridge page", "PARSER_ERROR");
  const iframeUrl = m[1]!;

  logger.debug("fetch", `Iframe URL: ${iframeUrl.slice(0, 100)}`);

  if (iframeUrl.includes("/e/")) {
    logger.debug("fetch", "/e/ detected, calling extractBest...");
    const session = await sessionManager.getSession();
    const result = await extractBest(iframeUrl, {
      signal: options?.signal,
      userAgent: session?.userAgent,
    });
    if (result) {
      logger.debug("fetch", `extractBest OK: ${result.url.slice(0, 80)}`);
      return result;
    }
  }

  return { url: iframeUrl };
}

export const source = {
  getBrowsePage,
  searchRaw,
  getDetails,
  getEpisodeServers,
  resolveStreamUrl,
};
