import { logger } from "@/utils/logger";

type NavigateFn = (uri: string) => void;
type InjectFn = (js: string) => void;

export type WebViewResult =
  | { ok: true; status: number; body: string }
  | { ok: false; error: string };

// A page fetch is slower than a native one; the cap is here so a worker that
// never answers cannot hold the caller forever
const REQUEST_TIMEOUT = 20_000;

/**
 * Runs a request inside the worker's page context, so the browser attaches its
 * own jar (HttpOnly included) and the app never reads a cookie. Same-origin
 * only: a cross-origin fetch is refused by the page's CORS policy.
 */
function buildScript(id: number, url: string): string {
  return `(async function(){
  var post = function(payload){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload)); };
  try {
    var r = await fetch(${JSON.stringify(url)}, { credentials: "include", headers: { "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
    post({ type: "HTTP", data: { id: ${id}, status: r.status, body: await r.text() } });
  } catch (e) {
    post({ type: "HTTP", data: { id: ${id}, error: String((e && e.message) || e) } });
  }
})(); true;`;
}

export class WebViewBridge {
  private navigateFn: NavigateFn | null = null;
  private injectFn: InjectFn | null = null;
  private loaded = false;
  private nextId = 1;
  private pending = new Map<number, (result: WebViewResult) => void>();

  registerNavigation(fn: NavigateFn) {
    this.navigateFn = fn;
  }

  registerInjector(fn: InjectFn) {
    this.injectFn = fn;
  }

  /** The page must be loaded before injected JS can run at all */
  setLoaded(loaded: boolean) {
    this.loaded = loaded;
  }

  canNavigate(): boolean {
    return this.navigateFn != null;
  }

  navigateTo(uri: string): void {
    if (this.navigateFn) {
      logger.info("session", `Navigating to ${uri.slice(0, 80)}...`);
      this.navigateFn(uri);
    }
  }

  fetchInPage(url: string, timeout = REQUEST_TIMEOUT): Promise<WebViewResult> {
    if (this.injectFn == null || !this.loaded) {
      return Promise.resolve({ ok: false, error: "worker not ready" });
    }
    const id = this.nextId++;
    const inject = this.injectFn;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // A late answer arrives with no waiter: dropping it here is the only
        // thing keeping a timed-out request from resolving a newer one
        this.pending.delete(id);
        resolve({ ok: false, error: "timeout" });
      }, timeout);
      this.pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      logger.debug("session", `WebView request ${id}: ${url.slice(0, 80)}`);
      inject(buildScript(id, url));
    });
  }

  handleMessage(message: string): { type: string; data: unknown } | null {
    try {
      const parsed = JSON.parse(message);
      return { type: parsed.type, data: parsed.data };
    } catch {
      return null;
    }
  }

  /** Feeds a request answer from the worker; false when nobody waits on that id */
  handleHttp(data: unknown): boolean {
    const payload = data as { id?: number; status?: number; body?: string; error?: string } | null;
    if (payload?.id == null) return false;
    const resolve = this.pending.get(payload.id);
    if (resolve == null) {
      logger.debug("session", `Dropped late WebView answer ${payload.id}`);
      return false;
    }
    this.pending.delete(payload.id);
    if (payload.error != null) {
      logger.warn("session", `WebView request ${payload.id} failed: ${payload.error}`);
      resolve({ ok: false, error: payload.error });
      return true;
    }
    resolve({ ok: true, status: payload.status ?? 0, body: payload.body ?? "" });
    return true;
  }
}

export const webViewBridge = new WebViewBridge();
