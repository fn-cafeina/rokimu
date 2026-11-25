import Constants from "expo-constants";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";
import { storage } from "@/utils/storage";
import { persistWithRollback } from "@/utils/persist";
import { logger } from "@/utils/logger";
import { SourceError } from "@/utils/errors";
import {
  EMPTY_CHECK,
  dataFromStored,
  isNewer,
  parseStoredCheck,
  shouldCheck,
  type StoredCheck,
  type UpdateCheckData,
} from "@/utils/updateCheck";
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
import { fetchLatestRelease } from "@/services/release";

export const UPDATE_CHECK_KEY = "update_check_enabled";
const INSTALL_PERMISSION_KEY = "install_permission_granted";
/** Survives launches: the throttle and the ETag only pay off if they persist. */
const UPDATE_STATE_KEY = "update_check_state";

type UpdatePhase =
  | "idle"
  | "confirm"
  | "permission"
  | "downloading"
  | "installing"
  | "error"
  | "ready";

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
      const release = await fetchLatestRelease({ etag: previous.etag, signal });
      if (release.notModified) {
        await persistCheck({ ...previous, checkedAt: Date.now() });
        return known ?? { updateAvailable: null, apkUrl: null };
      }

      const isPrerelease = (release.tag ?? "").includes("-");
      const result = {
        updateAvailable:
          release.tag != null && !isPrerelease && isNewer(release.tag, current) ? release.tag : null,
        apkUrl: release.apkUrl,
      };
      // Stored even when it is not an update: the anchor and the ETag are what
      // keep the next launch from spending a request. A release-less answer
      // parks nulls, which is the empty anchor the next check starts from.
      await persistCheck({
        checkedAt: Date.now(),
        etag: release.etag,
        tag: release.tag,
        apkUrl: release.apkUrl,
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
