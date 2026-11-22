import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { NEXT_EPISODE_COUNTDOWN_SECONDS } from "@/config/player";
import { ErrorState } from "@/components/ui/ErrorState";
import { PlayerControls } from "@/components/player/PlayerControls";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { orderEpisodes } from "@/hooks/episodePagination";
import { WATCHED_THRESHOLD } from "@/hooks/episodeProgress";
import { useAnimeDetail } from "@/hooks/useAnimeDetail";
import { useEpisodeNavigation } from "@/hooks/useEpisodeNavigation";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePlayerStore } from "@/stores/playerStore";
import { useHistoryStore } from "@/stores/historyStore";
import { findHistoryEntry } from "@/utils/history";
import { setupImmersiveMode, cleanupImmersiveMode } from "@/services/playerUI";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function PlayerContent() {
  const params = useLocalSearchParams<{ slug?: string; number?: string; title?: string; image?: string }>();
  const slug = params.slug ?? "";
  const number = params.number ?? "";
  const title = params.title ?? "";
  const image = params.image ?? "";
  const insets = useSafeAreaInsets();

  const stream = usePlayerStore((s) => s.stream);
  const streamEpNumber = usePlayerStore((s) => s.streamEpisodeNumber);
  const clearStream = usePlayerStore((s) => s.reset);
  const streamUrl = stream.data?.url ?? null;
  const streamHeaders = stream.data?.headers ?? null;
  const resolveStream = usePlayerStore((s) => s.resolveStream);
  const serversState = usePlayerStore((s) => s.servers);
  const addToHistory = useHistoryStore((s) => s.addToHistory);
  const { anime } = useAnimeDetail(slug);
  const { isInternetReachable: networkOk } = useNetworkStatus();
  const networkOkRef = useRef<boolean | null>(null);
  useEffect(() => {
    networkOkRef.current = networkOk;
  }, [networkOk]);
  const prevNetworkOk = useRef<boolean | null>(null);
  const saveProgressRef = useRef<() => void>(() => {});
  const [playState, setPlayState] = useState({ currentTime: 0, duration: 0, isPlaying: false });

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    // Default Android buffer is 20s; short skips then fall outside the buffer and stall
    instance.bufferOptions = {
      preferredForwardBufferDuration: 90,
      prioritizeTimeOverSizeThreshold: true,
    };
    // Exact seeks force re-decoding from the previous keyframe; a small tolerance lets
    // ExoPlayer snap to a nearby keyframe, making ±10s skips near-instant
    instance.seekTolerance = { toleranceBefore: 1, toleranceAfter: 1 };
    // Drives the progress bar; polling the player from JS re-rendered the whole
    // screen four times a second for the same value
    instance.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    const prev = prevNetworkOk.current;
    prevNetworkOk.current = networkOk;
    if (prev !== false && networkOk === false) {
      saveProgressRef.current();
      player.pause();
    }
  }, [networkOk, player]);

  const { resolveAndPlay, loading, currentEpNumber, setCurrentEpNumber } = useEpisodeNavigation(player, title, image);

  useEffect(() => { setCurrentEpNumber(number); }, [number, setCurrentEpNumber]);

  useEffect(() => {
    // setupImmersiveMode rethrows after logging; a lock failure must not leave
    // an unhandled rejection behind
    void setupImmersiveMode().catch(() => {});
    return () => {
      void cleanupImmersiveMode();
      void clearStream();
    };
  }, [clearStream]);

  const episodesData = anime?.episodes;
  const episodes = useMemo(() => (episodesData ? orderEpisodes(episodesData) : []), [episodesData]);
  const currentIdx = useMemo(() => episodes.findIndex((e) => e.number === currentEpNumber), [episodes, currentEpNumber]);
  const prevEpisode = useMemo(() => (currentIdx < 1 ? null : episodes[currentIdx - 1]), [episodes, currentIdx]);
  const nextEpisode = useMemo(() => (currentIdx < 0 || currentIdx >= episodes.length - 1 ? null : episodes[currentIdx + 1]), [episodes, currentIdx]);

  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      setPlayState((prev) => ({ ...prev, currentTime, duration: player.duration }));
    });
    return () => { sub.remove(); };
  }, [player]);

  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [countdownEp, setCountdownEp] = useState<string | null>(null);
  const nextEpisodeTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const nextEpisodeCountdownRef = useRef<number | null>(null);

  const clearNextEpisodeTimer = useCallback(() => {
    if (nextEpisodeTimer.current) {
      clearInterval(nextEpisodeTimer.current);
      nextEpisodeTimer.current = undefined;
    }
    nextEpisodeCountdownRef.current = null;
    setNextEpisodeCountdown(null);
  }, []);

  const confirmNextEpisode = useCallback(() => {
    clearNextEpisodeTimer();
    if (nextEpisode) {
      saveProgressRef.current();
      void resolveAndPlay(slug, nextEpisode);
    }
  }, [clearNextEpisodeTimer, nextEpisode, slug, resolveAndPlay]);

  const cancelNextEpisode = useCallback(() => {
    clearNextEpisodeTimer();
  }, [clearNextEpisodeTimer]);

  const startNextEpisodeCountdown = useCallback(() => {
    if (!nextEpisode) return;
    nextEpisodeCountdownRef.current = NEXT_EPISODE_COUNTDOWN_SECONDS;
    setNextEpisodeCountdown(NEXT_EPISODE_COUNTDOWN_SECONDS);
    setCountdownEp(currentEpNumber);
    nextEpisodeTimer.current = setInterval(() => {
      const prev = nextEpisodeCountdownRef.current;
      if (prev === null || prev <= 0) {
        clearNextEpisodeTimer();
        saveProgressRef.current();
        void resolveAndPlay(slug, nextEpisode);
        return;
      }
      nextEpisodeCountdownRef.current = prev - 1;
      setNextEpisodeCountdown(prev - 1);
    }, 1000);
  }, [nextEpisode, clearNextEpisodeTimer, slug, resolveAndPlay, currentEpNumber]);

  // Leaving the screen mid-countdown: without this the interval survives the
  // unmount and auto-advances ten seconds later on a disposed player
  useEffect(() => clearNextEpisodeTimer, [clearNextEpisodeTimer]);

  const handlePrev = useCallback(() => { if (prevEpisode) void resolveAndPlay(slug, prevEpisode); }, [prevEpisode, slug, resolveAndPlay]);
  const handleNext = useCallback(() => { if (nextEpisode) void resolveAndPlay(slug, nextEpisode); }, [nextEpisode, slug, resolveAndPlay]);
  const handleBack = useCallback(() => router.back(), []);

  const lastSeekKey = useRef("");
  const loadedUrlRef = useRef<string | null>(null);

  // eslint-disable-next-line react-hooks/immutability -- expo-video player is a native imperative handle; media loading mutates it by design
  useEffect(() => {
    // A payload carrying a failed status belongs to the previous episode: loading
    // it would play the wrong media behind the error screen
    if (streamUrl == null || streamEpNumber == null || stream.status !== "success") return;
    let cancelled = false;
    const run = async () => {
      // streamEpNumber settles with (or before) the stream, so the loaded media
      // always matches it: the saved-progress seek applies right after the load,
      // for the first episode and for every following one alike
      if (loadedUrlRef.current !== streamUrl) {
        loadedUrlRef.current = streamUrl;
        // eslint-disable-next-line react-hooks/immutability -- expo-video player is a native imperative handle; loading media mutates it by design
        await player.replaceAsync({ uri: streamUrl, headers: streamHeaders ?? undefined });
        if (cancelled) return;
      }
      const seekKey = `${slug}_${streamEpNumber}`;
      if (seekKey !== lastSeekKey.current) {
        lastSeekKey.current = seekKey;
        const match = findHistoryEntry(useHistoryStore.getState().lastViewed, slug, streamEpNumber);
        const hasSignificantProgress = match != null && (match.progress ?? 0) > 10;
        const isCompleted = match != null && match.progress != null && match.duration != null && match.duration > 0 && match.progress / match.duration >= WATCHED_THRESHOLD;
        if (match?.progress != null && hasSignificantProgress && !isCompleted) {
          try { player.currentTime = match.progress; } catch {}
        }
      }
      if (networkOkRef.current !== false) player.play();
    };
    void run();
    return () => { cancelled = true; };
  }, [streamUrl, streamHeaders, player, slug, streamEpNumber, stream.status]);

  // A failure must stop the media the player still holds and force the next
  // attempt to reload: skipping the replace would leave ExoPlayer on a
  // terminal error state that play() cannot recover from
  useEffect(() => {
    if (stream.status !== "error") return;
    player.pause();
    loadedUrlRef.current = null;
  }, [stream.status, player]);

  const historyCtx = useRef({ title, url: slug, image, number: currentEpNumber });
  useEffect(() => {
    historyCtx.current = { title, url: slug, image, number: currentEpNumber };
  }, [title, slug, image, currentEpNumber]);

  const saveProgress = useCallback(() => {
    try {
      const ct = player.currentTime;
      const dur = player.duration;
      if (ct > 0 && dur > 0) {
        let progress = ct;
        if (dur > 0 && progress / dur >= WATCHED_THRESHOLD) progress = dur;
        void addToHistory({ ...historyCtx.current, progress, duration: dur, timestamp: Date.now() });
      }
    } catch {}
  }, [player, addToHistory]);
  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);

  useEffect(() => {
    // Sampling a payload that no longer owns the screen would save the previous
    // episode's position under the new episode's number
    if (streamUrl == null || stream.status !== "success") return;
    const interval = setInterval(saveProgress, 10000);
    return () => { clearInterval(interval); };
  }, [streamUrl, stream.status, saveProgress]);

  useEffect(() => {
    return () => {
      saveProgress();
    };
  }, [saveProgress]);

  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const sub = player.addListener("playingChange", ({ isPlaying: playing }) => {
      if (playing) hasPlayedRef.current = true;
      setPlayState((prev) => ({ ...prev, isPlaying: playing }));
    });
    return () => { sub.remove(); };
  }, [player]);

  // A stream can resolve fine and still die at the video layer (expired CDN
  // token, rejected playback): settle it as a real error instead of leaving
  // a mounted player that never plays. Ignored while a request is in flight,
  // so a resolution still loading owns its own settling. One reload of the
  // same media comes first: ExoPlayer reports recoverable failures as errors.
  const errorReloadRef = useRef<string | null>(null);

  useEffect(() => {
    const fail = (message: string | undefined) => {
      usePlayerStore.getState().failStream({ type: "VIDEO_ERROR", message: message ?? "Video player error" });
    };
    const sub = player.addListener("statusChange", ({ status, error }) => {
      if (status !== "error") return;
      if (streamUrl != null && errorReloadRef.current !== streamUrl) {
        errorReloadRef.current = streamUrl;
        void player
          .replaceAsync({ uri: streamUrl, headers: streamHeaders ?? undefined })
          .then(() => player.play())
          .catch(() => fail(error?.message));
        return;
      }
      fail(error?.message);
    });
    return () => { sub.remove(); };
  }, [player, streamUrl, streamHeaders]);

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => {
      if (nextEpisode && hasPlayedRef.current) {
        hasPlayedRef.current = false;
        startNextEpisodeCountdown();
      }
    });
    return () => { sub.remove(); };
  }, [player, nextEpisode, startNextEpisodeCountdown]);

  // Episode changed: kill any pending auto-next timer. The countdown state is
  // gated on countdownEp when passed to PlayerControls, so no setState here.
  useEffect(() => {
    if (nextEpisodeTimer.current) {
      clearInterval(nextEpisodeTimer.current);
      nextEpisodeTimer.current = undefined;
    }
    nextEpisodeCountdownRef.current = null;
  }, [currentEpNumber]);

  // A failed stream resolution is a real failure: show it honestly with a
  // retry that re-runs the full servers + stream path, plus a hand-picked
  // server for the cases the ladder could not settle
  if (stream.status === "error") {
    const retryNumber = currentEpNumber || number;
    const alternatives = serversState.dataKey === `${slug}_${retryNumber}` ? serversState.data ?? [] : [];
    return (
      <View className="flex-1 bg-black">
        <ErrorState
          error={stream.error}
          onRetry={() => {
            if (retryNumber) void resolveAndPlay(slug, { number: retryNumber });
          }}
        />
        {alternatives.length > 0 && retryNumber !== "" && (
          <View className="px-5 pb-8">
            <Text className="mb-2 text-xs text-neutral-500">Probar otro servidor</Text>
            <View className="flex-row flex-wrap gap-2">
              {alternatives.map((s) => (
                <AnimatedPressable
                  key={s.id}
                  className="rounded-lg bg-white/10 px-4 py-2"
                  onPress={() => void resolveStream(s, { slug, number: retryNumber })}
                >
                  <Text className="text-xs text-neutral-200">{s.title} · {s.language}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />
      <VideoView key={streamUrl ?? "no-stream"} player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />
      <PlayerControls
        player={player}
        isPlaying={playState.isPlaying}
        currentTime={playState.currentTime}
        duration={playState.duration}
        animeTitle={title}
        episodeNumber={currentEpNumber}
        hasPrev={prevEpisode != null}
        hasNext={nextEpisode != null}
        loading={loading || streamUrl == null}
        insetTop={insets.top}
        nextEpisodeCountdown={countdownEp === currentEpNumber ? nextEpisodeCountdown : null}
        nextEpisodeNumber={nextEpisode?.number ?? null}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleBack}
        onCancelNextEpisode={cancelNextEpisode}
        onConfirmNextEpisode={confirmNextEpisode}
      />
    </View>
  );
}

export default function NativePlayer() {
  return (
    <ErrorBoundary>
      <PlayerContent />
    </ErrorBoundary>
  );
}
