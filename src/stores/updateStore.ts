import Constants from "expo-constants";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import { TIMEOUTS } from "@/config/cache";
import { storage } from "@/utils/storage";
import { persistWithRollback } from "@/utils/persist";
import { logger } from "@/utils/logger";
import { SourceError, isCancelled } from "@/utils/errors";
import { withTimeout } from "@/utils/withTimeout";
import { EMPTY_CHECK, parseStoredCheck, shouldCheck, type StoredCheck } from "@/utils/updateCheck";
import {
  ResourceRunner,
  resourceInitialState,
  type ResourceState,
} from "@/utils/resource";
import {
  downloadApkWithProgress,
  installApk,
  cleanupOldApk,
  openInstallPermissionSettings,
  type DownloadProgress,
} from "@/services/updater";

export const UPDATE_CHECK_KEY = "update_check_enabled";
const INSTALL_PERMISSION_KEY = "install_permission_granted";
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/fn-cafeina/rokimu/releases/latest";
/** Survives launches: the throttle and the ETag only pay off if they persist. */
const UPDATE_STATE_KEY = "update_check_state";

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

function isNewer(latest: string, current: string): boolean {
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

type UpdatePhase =
  | "idle"
  | "confirm"
  | "permission"
  | "downloading"
  | "installing"
  | "error"
  | "ready";

interface UpdateCheckData {
  updateAvailable: string | null;
  apkUrl: string | null;
}

interface UpdateState {
  updateCheckEnabled: boolean;
  check: ResourceState<UpdateCheckData>;
  currentVersion: string | null;
  phase: UpdatePhase;
  progress: DownloadProgress;
  errorMessage: string | null;
  installPermissionGranted: boolean;
  /** True only while the user is away granting the install permission */
  resumeAfterPermission: boolean;
  initialize: (enabled: boolean) => void;
  setUpdateCheckEnabled: (enabled: boolean) => Promise<void>;
  checkForUpdates: (force?: boolean) => Promise<boolean>;
  startUpdate: () => void;
  closeUpdate: () => void;
  confirmUpdate: () => Promise<void>;
  beginDownload: () => Promise<void>;
  cancelDownload: () => void;
}

let downloadAbort: AbortController | null = null;
let checkPromise: Promise<boolean> | null = null;
let storedCheck: StoredCheck | null = null;

const CHECK_KEY = "check";
export const UPDATE_CHECK_RESOURCE_KEY = CHECK_KEY;

/** Release held from the last answer, when it beats the installed version. */
function dataFromStored(value: StoredCheck, current: string): UpdateCheckData | null {
  if (value.tag == null || value.apkUrl == null) return null;
  // Prereleases and downgrades never reach the user
  if (value.tag.includes("-") || !isNewer(value.tag, current)) return null;
  return { updateAvailable: value.tag, apkUrl: value.apkUrl };
}

async function loadStoredCheck(): Promise<StoredCheck> {
  if (storedCheck != null) return storedCheck;
  const raw = await storage.get<unknown>(UPDATE_STATE_KEY);
  storedCheck = parseStoredCheck(raw) ?? { ...EMPTY_CHECK };
  return storedCheck;
}

async function persistCheck(next: StoredCheck): Promise<void> {
  storedCheck = next;
  try {
    await storage.set(UPDATE_STATE_KEY, next);
  } catch (error) {
    // Losing the anchor only costs one extra request on the next launch
    logger.warn("update", "Failed to persist the update check", error);
  }
}

export const useUpdateStore = create<UpdateState>((set, get) => {
  const checkRunner = new ResourceRunner<UpdateCheckData>({
    tag: "updateCheck",
    get: () => get().check,
    set: (check) => set({ check }),
  });

  /** Shows a stored release without waiting for the network. */
  function seedCheck(current: string, data: UpdateCheckData | null): void {
    if (data == null) return;
    // A request in flight owns the state and settles it itself
    if (get().check.status === "loading") return;
    set({
      currentVersion: current,
      check: { status: "success", key: CHECK_KEY, dataKey: CHECK_KEY, data, error: null, requestId: 0 },
    });
  }

  async function runCheck(force: boolean): Promise<boolean> {
    const current = Constants.expoConfig?.version;
    if (!current) {
      checkRunner.fail(CHECK_KEY, new SourceError("Error al obtener versión", "UNKNOWN"));
      return false;
    }
    if (!force && get().updateCheckEnabled === false) return true;

    const previous = await loadStoredCheck();
    const known = dataFromStored(previous, current);
    if (!force && !shouldCheck(previous.checkedAt, Date.now())) {
      seedCheck(current, known);
      return true;
    }

    // Non-forced checks skip silently when offline; a forced one surfaces it
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false || net.isInternetReachable === false) {
        if (!force) {
          seedCheck(current, known);
          return true;
        }
        checkRunner.fail(CHECK_KEY, new SourceError("Sin conexión", "NETWORK_ERROR"));
        return false;
      }
    } catch {
    }

    const outcome = await checkRunner.load(CHECK_KEY, async (signal) => {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "Rokimu-Android",
      };
      // An unchanged release answers 304, which costs no rate limit
      if (previous.etag != null) headers["If-None-Match"] = previous.etag;

      let res: Response;
      // One helper owns the deadline: a stall here is a timeout the check can
      // report, not a cancellation that leaves the row stuck on "Buscando..."
      try {
        res = await withTimeout(
          signal,
          TIMEOUTS.UPDATE_CHECK,
          (requestSignal) => fetch(GITHUB_RELEASES_URL, { headers, signal: requestSignal }),
          "Se agotó el tiempo de búsqueda",
        );
      } catch (err) {
        if (err instanceof SourceError || isCancelled(err)) throw err;
        throw new SourceError("Error al buscar actualizaciones", "NETWORK_ERROR");
      }

      if (res.status === 304) {
        await persistCheck({ ...previous, checkedAt: Date.now() });
        return known ?? { updateAvailable: null, apkUrl: null };
      }
      if (res.status === 404) {
        await persistCheck({ ...EMPTY_CHECK, checkedAt: Date.now() });
        return { updateAvailable: null, apkUrl: null };
      }
      if (!res.ok) throw new SourceError("Error al buscar actualizaciones", "NETWORK_ERROR");

      const data = (await res.json()) as {
        tag_name?: string;
        assets?: { name: string; browser_download_url: string; size?: number }[];
      };
      const latest = (data.tag_name ?? "").replace(/^v/, "").trim();
      if (!latest) throw new SourceError("Error al buscar actualizaciones", "UNKNOWN");
      const isPrerelease = latest.includes("-");
      const apkAsset = data.assets?.find(
        (a) =>
          a.name.toLowerCase().startsWith("rokimu-") &&
          a.name.toLowerCase().endsWith(".apk") &&
          (a.size == null || a.size > 5 * 1024 * 1024),
      );
      const result = {
        updateAvailable: !isPrerelease && isNewer(latest, current) ? latest : null,
        apkUrl: apkAsset?.browser_download_url ?? null,
      };
      // Stored even when it is not an update: the anchor and the ETag are what
      // keep the next launch from spending a request
      await persistCheck({
        checkedAt: Date.now(),
        etag: res.headers.get("etag"),
        tag: latest,
        apkUrl: result.apkUrl,
      });
      return result;
    });

    if (outcome.status !== "success") return false;
    set({ currentVersion: current });
    return true;
  }

  return {
  updateCheckEnabled: true,
  check: resourceInitialState<UpdateCheckData>(),
  currentVersion: null,
  phase: "idle",
  progress: { receivedBytes: 0, totalBytes: null },
  errorMessage: null,
  installPermissionGranted: false,
  resumeAfterPermission: false,

  initialize: (enabled) => {
    const currentVersion = Constants.expoConfig?.version ?? null;
    set({ updateCheckEnabled: enabled, currentVersion });
    cleanupOldApk();
    void storage
      .get<boolean>(INSTALL_PERMISSION_KEY)
      .then((granted) => set({ installPermissionGranted: granted === true }))
      .catch(() => {});
    // The release kept from the last check is on screen before the request runs
    if (currentVersion != null) {
      void loadStoredCheck().then((previous) => seedCheck(currentVersion, dataFromStored(previous, currentVersion)));
    }
  },

  setUpdateCheckEnabled: async (enabled) => {
    const prev = get().updateCheckEnabled;
    set({ updateCheckEnabled: enabled });
    await persistWithRollback(
      () => storage.set(UPDATE_CHECK_KEY, enabled),
      () => set({ updateCheckEnabled: prev }),
      "update",
    );
  },

  checkForUpdates: async (force = false) => {
    // A manual tap must not settle with the throttled answer of the background
    // check already in flight: it waits for that one, then runs its own
    if (checkPromise) {
      if (!force) return checkPromise;
      await checkPromise;
    }
    checkPromise = runCheck(force);
    try {
      return await checkPromise;
    } finally {
      checkPromise = null;
    }
  },
  startUpdate: () => {
    const data = get().check.data;
    if (data?.updateAvailable == null) return;
    if (data.apkUrl == null) {
      set({ phase: "error", errorMessage: "No hay archivo de instalación disponible para esta versión." });
      return;
    }
    set({ phase: "confirm", errorMessage: null });
  },

  closeUpdate: () => {
    if (get().phase === "downloading") {
      downloadAbort?.abort();
      downloadAbort = null;
    }
    set({ phase: "idle", errorMessage: null, resumeAfterPermission: false });
  },

  confirmUpdate: async () => {
    if (!get().installPermissionGranted) {
      set({ phase: "permission" });
      return;
    }
    await get().beginDownload();
  },

  beginDownload: async () => {
    // Re-entrant call (double tap, or AppState resume racing the settings flow)
    if (get().phase === "downloading") return;

    const { apkUrl } = get().check.data ?? { apkUrl: null };
    if (apkUrl == null) return;

    downloadAbort = new AbortController();
    set({
      phase: "downloading",
      progress: { receivedBytes: 0, totalBytes: null },
      errorMessage: null,
    });

    try {
      const { file, cancelled } = await downloadApkWithProgress(
        apkUrl,
        (progress) => set({ progress }),
        downloadAbort.signal,
      );
      if (cancelled) {
        set({ phase: "idle" });
        return;
      }
      set({ phase: "installing" });
      let install: "installed" | "cancelled";
      try {
        install = await installApk(file);
      } catch (installErr) {
        // Permission may never have been granted: force the permission
        // screen again next time instead of failing silently forever
        set({ installPermissionGranted: false });
        void storage.set(INSTALL_PERMISSION_KEY, false);
        throw installErr;
      }
      // A dismissal is the user's call: keep the grant, don't show an error
      if (install === "cancelled") {
        set({ phase: "idle" });
        return;
      }
      set({ installPermissionGranted: true });
      void storage.set(INSTALL_PERMISSION_KEY, true);
      set({ phase: "ready" });
    } catch (err) {
      logger.error("update", "Download/install failed", err);
      const message =
        err instanceof Error && err.message === "stalled"
          ? "La descarga se detuvo por conexión lenta. Reintentá cuando tengas mejor señal."
          : err instanceof Error && err.message === "timeout"
            ? "La descarga tardó demasiado. Reintentá con mejor conexión."
            : err instanceof Error
              ? err.message
              : "No se pudo completar la actualización.";
      set({ phase: "error", errorMessage: message });
    } finally {
      downloadAbort = null;
    }
  },

  cancelDownload: () => {
    downloadAbort?.abort();
    downloadAbort = null;
    set({ phase: "idle" });
  },
  };
});

export async function grantInstallPermissionAndDownload(): Promise<void> {
  const store = useUpdateStore.getState();
  try {
    // Arm the AppState resume only now: merely being in the "permission" phase
    // (e.g. an unrelated background/foreground cycle) must not auto-download
    // without the permission granted
    useUpdateStore.setState({ resumeAfterPermission: true });
    await openInstallPermissionSettings();
    // The OS toggle persists per-app, so remember the grant the moment the
    // user returns; a successful install replaces the process before any
    // later persist could land. A denial surfaces when installApk fails and
    // re-arms the ask.
    useUpdateStore.setState({ installPermissionGranted: true });
    void storage.set(INSTALL_PERMISSION_KEY, true);
    await store.beginDownload();
  } catch (err) {
    logger.error("update", "Permission flow failed", err);
    useUpdateStore.setState({
      phase: "error",
      errorMessage: "No se pudo abrir los ajustes de instalación.",
    });
  }
}
