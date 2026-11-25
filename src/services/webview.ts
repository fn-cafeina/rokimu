import { logger } from "@/utils/logger";

type NavigateFn = (uri: string) => void;
type ReloadFn = () => void;

/**
 * The hidden worker page has one job: clearing Cloudflare's challenge so the
 * native fetcher has a cookie jar to speak with. Requests never run inside the
 * page; that path went away with the switch to `fetchWithSession`.
 */
export class WebViewBridge {
  private navigateFn: NavigateFn | null = null;
  private reloadFn: ReloadFn | null = null;

  registerNavigation(fn: NavigateFn) {
    this.navigateFn = fn;
  }

  registerReloader(fn: ReloadFn) {
    this.reloadFn = fn;
  }

  /** A wedged or crashed page never answers; a fresh load gives the next wash a chance */
  reload(): void {
    if (this.reloadFn) {
      logger.info("session", "Reloading WebView worker");
      this.reloadFn();
    }
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

  handleMessage(message: string): { type: string; data: unknown } | null {
    try {
      const parsed = JSON.parse(message);
      return { type: parsed.type, data: parsed.data };
    } catch {
      return null;
    }
  }
}

export const webViewBridge = new WebViewBridge();
