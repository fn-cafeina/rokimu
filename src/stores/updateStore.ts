import Constants from "expo-constants";
import { create } from "zustand";
import { storage } from "@/utils/storage";
import { persistWithRollback } from "@/utils/persist";
import { logger } from "@/utils/logger";
import type { UpdateCheckData } from "@/utils/updateCheck";
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
import { createReleaseCheck, RELEASE_CHECK_KEY } from "@/services/releaseCheck";

export const UPDATE_CHECK_KEY = "update_check_enabled";
const INSTALL_PERMISSION_KEY = "install_permission_granted";

export const UPDATE_CHECK_RESOURCE_KEY = RELEASE_CHECK_KEY;

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

export const useUpdateStore = create<UpdateState>((set, get) => {
  const checkRunner = new ResourceRunner<UpdateCheckData>({
    tag: "updateCheck",
    get: () => get().check,
    set: (check) => set({ check }),
  });

  // The check lives in its own module: this store owns the download and install
  // machine, which is the part with phases, permissions and watchdogs
  const releaseCheck = createReleaseCheck({
    runner: checkRunner,
    getCheck: () => get().check,
    setCheck: (check) => set({ check }),
    setCurrentVersion: (currentVersion) => set({ currentVersion }),
    isEnabled: () => get().updateCheckEnabled !== false,
  });

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
    releaseCheck.initialize();
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

  checkForUpdates: releaseCheck.checkForUpdates,
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
