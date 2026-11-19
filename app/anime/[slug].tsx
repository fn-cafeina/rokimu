import { AnimatedPressable } from "@/components/AnimatedPressable";
import { AnimeDetailsHeader } from "@/components/AnimeDetailsHeader";
import { AnimeEpisodeModal } from "@/components/AnimeEpisodeModal";
import { EpisodeRangeSelector } from "@/components/EpisodeRangeSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { DetailTopBar } from "@/components/ui/DetailTopBar";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { useAnimeDetailScreen } from "@/hooks/useAnimeDetailScreen";
import { navigateBack } from "@/utils/navigation";
import { useHistoryStore } from "@/stores/historyStore";
import { findHistoryEntry } from "@/utils/history";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EpisodeDownloadButton } from "@/components/ui/EpisodeDownloadButton";
import { calcProgress } from "@/utils/math";
import { TAB_BAR_OFFSET } from "@/utils/layout";
import { orderEpisodes } from "@/hooks/episodeHelpers";
import { WATCHED_THRESHOLD, collectEpisodeProgress, pickCtaEpisode } from "@/hooks/episodeProgress";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ACCENT_COLOR } from "@/config/source";
import { memo, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCrossfade } from "@/hooks/useCrossfade";

const AnimeDetailsContent = memo(function AnimeDetailsContent() {
  const { slug } = useLocalSearchParams();
  const {
    anime, view, isAnimeLoading, error, rows, serverLoading, serverError, retryServers, setEpisodeOrder,
    isExpanded, setIsExpanded, selectedEpisode, setSelectedEpisode,
    hasLoaded, activeRangeIdx, setActiveRangeIdx, isRestoring,
    ranges, visibleEpisodes, isAscending, handleEpisodePress, handleDownloadPress, refresh,
  } = useAnimeDetailScreen(slug as string);

  // Subscribed so returning from the player repaints the episode progress bars
  const lastViewed = useHistoryStore((s) => s.lastViewed);

  const { ctaEpisode, continuing, watchedCount } = useMemo(() => {
    const ordered = orderEpisodes(anime?.episodes ?? []);
    const progress = collectEpisodeProgress(ordered, lastViewed, slug as string);
    const cta = pickCtaEpisode(ordered, progress);
    return {
      // Nothing played yet opens the first episode; something played with
      // nothing left to watch hides the CTA instead of offering a rewatch
      ctaEpisode: cta?.episode ?? (progress.length === 0 ? ordered[0] ?? null : null),
      continuing: cta != null,
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
                contentContainerStyle={{ paddingBottom: TAB_BAR_OFFSET }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={hasLoaded && isAnimeLoading} onRefresh={refresh} tintColor={ACCENT_COLOR} />}
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
                  continuing={continuing}
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
                  {visibleEpisodes.map((item) => {
                    const historyEntry = findHistoryEntry(lastViewed, slug as string, item.number);
                    const hasProgress = historyEntry != null && (historyEntry.progress ?? 0) > 0 && (historyEntry.duration ?? 0) > 0;
                    const pct = hasProgress ? calcProgress(historyEntry.progress, historyEntry.duration) : 0;
                    const isWatched = pct >= WATCHED_THRESHOLD;
                    // A finished episode fills the bar; the row itself stays plain,
                    // so the bar is the only thing that reports the progress
                    const barProgress = isWatched ? historyEntry!.duration : historyEntry?.progress;

                    return (
                      <AnimatedPressable key={item.id} onPress={() => handleEpisodePress(item)}>
                        <View className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
                          <View className="flex-row items-center justify-between p-4">
                            <Text className="text-base font-semibold text-white">Episodio {item.number}</Text>
                            <View className="flex-row items-center gap-4">
                              <EpisodeDownloadButton
                                slug={slug as string}
                                number={item.number}
                                onRequestDownload={() => handleDownloadPress(item)}
                              />
                            </View>
                          </View>
                          {hasProgress && (
                            <ProgressBar progress={barProgress} duration={historyEntry.duration} />
                          )}
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </ScrollView>

              <AnimeEpisodeModal
                visible={!!selectedEpisode}
                onClose={() => setSelectedEpisode(null)}
                title={`Episodio ${selectedEpisode?.number ?? ""}`}
                rows={rows}
                isLoading={serverLoading}
                error={serverError}
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
