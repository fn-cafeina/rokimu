import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { AnimeDetailsHeader } from "@/components/anime/AnimeDetailsHeader";
import { AnimeEpisodeModal } from "@/components/anime/AnimeEpisodeModal";
import { EpisodeRangeSelector } from "@/components/anime/EpisodeRangeSelector";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { DetailTopBar } from "@/components/anime/DetailTopBar";
import { DetailSkeleton } from "@/components/anime/DetailSkeleton";
import { useAnimeDetailScreen } from "@/hooks/useAnimeDetailScreen";
import { navigateBack } from "@/utils/navigation";
import { useHistoryStore } from "@/stores/historyStore";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EpisodeDownloadButton } from "@/components/downloads/EpisodeDownloadButton";
import { calcProgress } from "@/utils/math";
import { TAB_BAR_OFFSET } from "@/utils/layout";
import { orderEpisodes } from "@/hooks/episodeHelpers";
import { WATCHED_THRESHOLD, collectEpisodeProgress, pickCtaEpisode } from "@/hooks/episodeProgress";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ACCENT_COLOR } from "@/config/theme";
import { memo, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCrossfade } from "@/hooks/useCrossfade";
import type { Episode, HistoryItem } from "@/types";

interface EpisodeRowProps {
  slug: string;
  episode: Episode;
  entry: HistoryItem | undefined;
  onPress: (episode: Episode) => void;
  onDownload: (episode: Episode) => void;
}

const EpisodeRow = memo(function EpisodeRow({ slug, episode, entry, onPress, onDownload }: EpisodeRowProps) {
  const hasProgress = entry != null && (entry.progress ?? 0) > 0 && (entry.duration ?? 0) > 0;
  const pct = hasProgress ? calcProgress(entry!.progress, entry!.duration) : 0;
  const isWatched = pct >= WATCHED_THRESHOLD;
  // A finished episode fills the bar; the row itself stays plain,
  // so the bar is the only thing that reports the progress
  const barProgress = isWatched ? entry!.duration : entry?.progress;

  return (
    <AnimatedPressable onPress={() => onPress(episode)}>
      <View className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
        <View className="flex-row items-center justify-between p-4">
          <Text className="text-base font-semibold text-white">Episodio {episode.number}</Text>
          <View className="flex-row items-center gap-4">
            <EpisodeDownloadButton
              slug={slug}
              number={episode.number}
              onRequestDownload={() => onDownload(episode)}
            />
          </View>
        </View>
        {hasProgress && (
          <ProgressBar progress={barProgress} duration={entry!.duration} />
        )}
      </View>
    </AnimatedPressable>
  );
});

const AnimeDetailsContent = memo(function AnimeDetailsContent() {
  const { slug } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const {
    anime, view, isRefreshing, error, rows, serverLoading, serverError, serverOffline, retryServers, setEpisodeOrder,
    isExpanded, setIsExpanded, selectedEpisode, setSelectedEpisode,
    activeRangeIdx, setActiveRangeIdx, isRestoring,
    ranges, visibleEpisodes, isAscending, handleEpisodePress, handleDownloadPress, refresh,
  } = useAnimeDetailScreen(slug as string);

  // Subscribed so returning from the player repaints the episode progress bars
  const lastViewed = useHistoryStore((s) => s.lastViewed);

  // One lookup per episode instead of a history scan per row per render
  const progressByNumber = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    for (const item of lastViewed) {
      if (item.url === slug) map.set(item.number, item);
    }
    return map;
  }, [lastViewed, slug]);

  const { ctaEpisode, ctaMode, watchedCount } = useMemo(() => {
    const ordered = orderEpisodes(anime?.episodes ?? []);
    const progress = collectEpisodeProgress(ordered, lastViewed, slug as string);
    const cta = pickCtaEpisode(ordered, progress);
    const first = ordered[0] ?? null;
    // Nothing played starts at episode one; everything watched offers a
    // rewatch of episode one instead of dropping the CTA and shifting layout
    const mode: "continue" | "start" | "rewatch" =
      cta != null ? "continue" : progress.length === 0 ? "start" : "rewatch";
    return {
      ctaEpisode: cta?.episode ?? first,
      ctaMode: mode,
      watchedCount: progress.filter((item) => item.ratio >= WATCHED_THRESHOLD).length,
    };
  }, [anime?.episodes, lastViewed, slug]);

  const showContent = view === "content";
  const { keepSkeleton, skeletonStyle, contentStyle } = useCrossfade(showContent);

  if (view === "error") {
    return (
      <View className="flex-1 bg-black">
        <DetailTopBar anime={anime} onBack={navigateBack} />
        <ErrorState error={error} onRetry={refresh} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {showContent && (
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <View className="flex-1 bg-black">
              <ScrollView
                contentContainerStyle={{ paddingBottom: TAB_BAR_OFFSET + insets.bottom }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={ACCENT_COLOR} colors={[ACCENT_COLOR]} />}
              >
                <DetailTopBar anime={anime} onBack={navigateBack} />
                <AnimeDetailsHeader
                  anime={anime!}
                  relations={anime?.relations ?? null}
                  isExpanded={isExpanded}
                  setIsExpanded={setIsExpanded}
                  isAscending={isAscending}
                  toggleSort={() => void setEpisodeOrder(isAscending ? "desc" : "asc")}
                  ctaEpisode={ctaEpisode}
                  ctaMode={ctaMode}
                  onResume={handleEpisodePress}
                  watchedCount={watchedCount}
                />
                {ranges.length > 0 && (
                <EpisodeRangeSelector ranges={ranges} activeRangeIdx={activeRangeIdx} setActiveRangeIdx={setActiveRangeIdx} isRestoring={isRestoring} />
                )}
                <View className="px-5 mt-1 gap-3">
                  {visibleEpisodes.length === 0 && (
                    <View className="items-center pt-20">
                      <Feather name="frown" size={48} color="#404040" />
                      <Text className="mt-4 max-w-[300px] text-center text-sm text-neutral-500">Este anime aún no tiene episodios disponibles. Vuelve más tarde para comprobarlo.</Text>
                    </View>
                  )}
                  {visibleEpisodes.map((item) => (
                    <EpisodeRow
                      key={item.id}
                      slug={slug as string}
                      episode={item}
                      entry={progressByNumber.get(item.number)}
                      onPress={handleEpisodePress}
                      onDownload={handleDownloadPress}
                    />
                  ))}
                </View>
              </ScrollView>

              <AnimeEpisodeModal
                visible={!!selectedEpisode}
                onClose={() => setSelectedEpisode(null)}
                title={`Episodio ${selectedEpisode?.number ?? ""}`}
                rows={rows}
                isLoading={serverLoading}
                error={serverError}
                isOffline={serverOffline}
                onRetry={retryServers}
              />
            </View>
        </Animated.View>
      )}
      {(keepSkeleton || !showContent) && (
        <Animated.View style={[StyleSheet.absoluteFill, skeletonStyle]}>
          <DetailSkeleton topBar={<DetailTopBar anime={anime} onBack={navigateBack} />} />
        </Animated.View>
      )}
    </View>
  );
});

export default function AnimeDetails() {
  return (
    <ErrorBoundary>
      <AnimeDetailsContent />
    </ErrorBoundary>
  );
}
