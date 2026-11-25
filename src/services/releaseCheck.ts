import Constants from "expo-constants";
import NetInfo from "@react-native-community/netinfo";
import { storage } from "@/utils/storage";
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
import type { ResourceRunner, ResourceState } from "@/utils/resource";
import { fetchLatestRelease } from "./release";

/** The release the last check kept, so a launch shows it before the network. */
const UPDATE_STATE_KEY = "update_check_state";
export const RELEASE_CHECK_KEY = "check";

/**
 * The release check: throttle window, ETag, and the answer the app keeps across
 * launches. Kept out of the store, which owns the download and install side.
 */
export interface ReleaseCheckDeps {
  runner: ResourceRunner<UpdateCheckData>;
  getCheck: () => ResourceState<UpdateCheckData>;
  setCheck: (state: ResourceState<UpdateCheckData>) => void;
  setCurrentVersion: (version: string) => void;
  /** False when the user turned the check off */
  isEnabled: () => boolean;
}

export interface ReleaseCheck {
  /** Shows the stored release, if any, without waiting for the network */
  initialize: () => void;
  /** Resolves true when the check settled (found an update or not) */
  checkForUpdates: (force?: boolean) => Promise<boolean>;
}

export function createReleaseCheck(deps: ReleaseCheckDeps): ReleaseCheck {
  let checkPromise: Promise<boolean> | null = null;
  let storedCheck: StoredCheck | null = null;

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

  /** Shows a stored release without waiting for the network. */
  function seedCheck(current: string, data: UpdateCheckData | null): void {
    if (data == null) return;
    // A request in flight owns the state and settles it itself
    if (deps.getCheck().status === "loading") return;
    deps.setCurrentVersion(current);
    deps.setCheck({
      status: "success",
      key: RELEASE_CHECK_KEY,
      dataKey: RELEASE_CHECK_KEY,
      data,
      error: null,
      requestId: 0,
    });
  }

  async function runCheck(force: boolean): Promise<boolean> {
    const current = Constants.expoConfig?.version;
    if (!current) {
      deps.runner.fail(RELEASE_CHECK_KEY, new SourceError("Error al obtener versión", "UNKNOWN"));
      return false;
    }
    if (!force && !deps.isEnabled()) return true;

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
        deps.runner.fail(RELEASE_CHECK_KEY, new SourceError("Sin conexión", "NETWORK_ERROR"));
        return false;
      }
    } catch {
    }

    const outcome = await deps.runner.load(RELEASE_CHECK_KEY, async (signal) => {
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
    deps.setCurrentVersion(current);
    return true;
  }

  return {
    initialize: () => {
      const current = Constants.expoConfig?.version;
      if (current == null) return;
      // The release kept from the last check is on screen before the request runs
      void loadStoredCheck().then((previous) => seedCheck(current, dataFromStored(previous, current)));
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
  };
}
