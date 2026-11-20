import { create } from "zustand";
import { source } from "@/services/source";
import { CACHE_PREFIXES, CACHE_TTL } from "@/config/cache";
import { loadCached, resolveStreamCached, invalidateCachedStream } from "@/utils/cache";
import { storage } from "@/utils/storage";
import { logger } from "@/utils/logger";
import { SourceError, isAuthError, isCancelled, toAppError } from "@/utils/errors";
import { withAuthRetry } from "@/utils/retry";
import { findServer } from "@/utils/serverOrder";
import {
  ResourceRunner,
  resourceInitialState,
  type LoadOutcome,
  type ResourceState,
} from "@/utils/resource";
import type { AppError, StreamUrlResult, VideoServer } from "@/types";

export const STREAM_KEY = "stream";

interface PlayerState {
  servers: ResourceState<VideoServer[]>;
  stream: ResourceState<StreamUrlResult>;
  /** Episode the current stream resolution belongs to; set before the stream settles */
  streamEpisodeNumber: string | null;
  lastLanguage: string | null;
  fetchServers: (slug: string, number: string, force?: boolean) => Promise<LoadOutcome<VideoServer[]>>;
  resolveStream: (server: VideoServer, ctx: { slug: string; number: string }) => Promise<LoadOutcome<StreamUrlResult>>;
  /** Settles the stream from an orchestrator-level failure (e.g. servers fetch) */
  failStream: (error: AppError) => void;
  /** Plays an episode already saved on disk, without touching the network */
  playLocal: (number: string, playlistUri: string) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  const serversRunner = new ResourceRunner<VideoServer[]>({
    tag: "servers",
    get: () => get().servers,
    set: (servers) => set({ servers }),
  });
  const streamRunner = new ResourceRunner<StreamUrlResult>({
    tag: "stream",
    get: () => get().stream,
    set: (stream) => set({ stream }),
  });

  // Derived playback artifacts behind the episode in flight. Any playback
  // failure drops them: servers are only as fresh as the bridge URLs they
  // carry, so the next attempt regenerates the whole chain instead of
  // replaying a dead one
  let lastServersKey: string | null = null;
  let lastStreamServer: { url: string; id: string } | null = null;

  const dropPlaybackArtifacts = (): void => {
    if (lastStreamServer != null) void invalidateCachedStream(lastStreamServer);
    if (lastServersKey != null) void storage.remove(lastServersKey);
    lastStreamServer = null;
    lastServersKey = null;
  };

  // Bridge URLs expire with the session: a dead chain means the cached list is
  // as stale as the URL it carries
  const refreshServers = async (ctx: { slug: string; number: string }, signal: AbortSignal): Promise<VideoServer[]> => {
    const cacheKey = `${CACHE_PREFIXES.SERVERS}_${ctx.slug}_${ctx.number}`;
    lastServersKey = cacheKey;
    return loadCached(
      cacheKey,
      (sig) => source.getEpisodeServers(ctx.slug, ctx.number, { signal: sig }),
      { ttl: CACHE_TTL.SERVERS, signal, force: true },
    );
  };

  /**
   * Playback plays the server the user chose, or fails. A dead chain is an
   * expired bridge URL, so the same server gets one more try with a freshly
   * fetched URL — never a different server: switching here would hand the user
   * a source and an audio track they did not pick. The error screen's picker is
   * the only path to another server.
   */
  const resolveChosen = async (
    ctx: { slug: string; number: string },
    signal: AbortSignal,
    chosen: VideoServer,
    force: boolean,
  ): Promise<StreamUrlResult> => {
    lastStreamServer = chosen;
    try {
      const resolved = await resolveStreamCached(chosen, { force, signal });
      if (resolved == null) throw new SourceError("No se pudo resolver el stream", "VIDEO_ERROR");
      lastStreamServer = chosen;
      return resolved;
    } catch (error) {
      if (isAuthError(error) || isCancelled(error)) throw error;
      logger.warn("stream", `Chain dead on ${chosen.title} (${chosen.language}): ${toAppError(error).type}`);
      dropPlaybackArtifacts();
      const same = findServer(await refreshServers(ctx, signal), chosen);
      if (same == null) throw error;
      lastStreamServer = same;
      const retried = await resolveStreamCached(same, { force: true, signal });
      if (retried == null) throw error;
      return retried;
    }
  };

  return {
    servers: resourceInitialState<VideoServer[]>(),
    stream: resourceInitialState<StreamUrlResult>(),
    streamEpisodeNumber: null,
    lastLanguage: null,

    fetchServers: async (slug: string, number: string, force = false) => {
      const key = `${slug}_${number}`;
      const cacheKey = `${CACHE_PREFIXES.SERVERS}_${key}`;
      lastServersKey = cacheKey;
      return serversRunner.load(key, (signal) =>
        withAuthRetry(
          (attempt) =>
            loadCached(cacheKey, (sig) => source.getEpisodeServers(slug, number, { signal: sig }), {
              ttl: CACHE_TTL.SERVERS,
              signal,
              force: attempt > 0 ? true : force,
            }),
          { signal, maxRetries: 2, tag: "servers" },
        ),
      );
    },

    resolveStream: async (server: VideoServer, ctx: { slug: string; number: string }) => {
      set({ lastLanguage: server.language, streamEpisodeNumber: ctx.number });
      const outcome = await streamRunner.load(STREAM_KEY, (signal) =>
        withAuthRetry((attempt) => resolveChosen(ctx, signal, server, attempt > 0), {
          signal,
          maxRetries: 2,
          tag: "stream",
        }),
      );
      if (outcome.status === "error") dropPlaybackArtifacts();
      return outcome;
    },

    failStream: (error: AppError) => {
      logger.warn("stream", `Stream failed upstream: ${error.type}: ${error.message}`);
      dropPlaybackArtifacts();
      streamRunner.fail(STREAM_KEY, error);
    },

    playLocal: (number: string, playlistUri: string) => {
      dropPlaybackArtifacts();
      set({
        streamEpisodeNumber: number,
        stream: {
          status: "success",
          key: STREAM_KEY,
          dataKey: STREAM_KEY,
          data: { url: playlistUri },
          error: null,
          requestId: 0,
        },
      });
    },

    reset: () => {
      serversRunner.reset();
      streamRunner.reset();
      lastServersKey = null;
      lastStreamServer = null;
      set({ lastLanguage: null, streamEpisodeNumber: null });
    },
  };
});