import { AnimeDetailsHeader } from "@/components/AnimeDetailsHeader";
import { AnimeEpisodeModal } from "@/components/AnimeEpisodeModal";
import { EpisodeRangeSelector } from "@/components/EpisodeRangeSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAnimeDetailScreen } from "@/hooks/useAnimeDetailScreen";
import { navigateBack } from "@/utils/navigation";
import { useHistoryStore } from "@/stores/historyStore";
import { findHistoryEntry } from "@/utils/history";
import { calcProgress } from "@/utils/math";
import { SCREEN_BOTTOM_PADDING } from "@/utils/layout";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ACCENT_COLOR } from "@/config/source";
import { memo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useCrossfade } from "@/hooks/useCrossfade";

const AnimeDetailsContent = memo(function AnimeDetailsContent() {
  const { slug } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const {
    anime, view, isAnimeLoading, error, servers, serverLoading, serverError, retryServers, setEpisodeOrder,
    isExpanded, setIsExpanded, selectedEpisode, setSelectedEpisode,
    hasLoaded, activeRangeIdx, setActiveRangeIdx, isRestoring,
    ranges, visibleEpisodes, isAscending, handleEpisodePress, handleServerSelect, refresh,
  } = useAnimeDetailScreen(slug as string);

  // Subscribed so returning from the player repaints the episode progress bars
  const lastViewed = useHistoryStore((s) => s.lastViewed);

  const showContent = view === "content";
  const { keepSkeleton, skeletonStyle, contentStyle } = useCrossfade(showContent);

  if (view === "error") {
    return <ErrorState error={error} onRetry={refresh} />;
  }

  return (
    <View className="flex-1 bg-surface">
      {showContent && (
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={hasLoaded && isAnimeLoading} onRefresh={refresh} tintColor={ACCENT_COLOR} />}
          >
            <AnimeDetailsHeader
              anime={anime!}
              relations={anime?.relations ?? null}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              isAscending={isAscending}
              toggleSort={() => void setEpisodeOrder(isAscending ? "desc" : "asc")}
              insets={insets}
              onBackPress={navigateBack}
            />
            {ranges.length > 0 && (
              <EpisodeRangeSelector
                ranges={ranges}
                activeRangeIdx={activeRangeIdx}
                setActiveRangeIdx={setActiveRangeIdx}
                isRestoring={isRestoring}
              />
            )}
            <View className="mt-3 gap-2 px-4">
              {visibleEpisodes.length === 0 && (
                <EmptyState
                  icon="film"
                  title="Sin episodios disponibles"
                  description="Este anime todavía no tiene episodios. Vuelve más tarde para comprobarlo."
                />
              )}
              {visibleEpisodes.map((item) => {
                const historyEntry = findHistoryEntry(lastViewed, slug as string, item.number);
                const hasProgress = historyEntry != null && (historyEntry.progress ?? 0) > 0 && (historyEntry.duration ?? 0) > 0;
                const pct = hasProgress ? calcProgress(historyEntry.progress, historyEntry.duration) : 0;
                const barProgress = hasProgress && pct >= 0.9 ? historyEntry!.duration : historyEntry?.progress;

                return (
                  <AnimatedPressable
                    key={item.id}
                    onPress={() => handleEpisodePress(item)}
                    hapticFeedback
                    className="overflow-hidden rounded-2xl bg-surface-container"
                    accessibilityLabel={`Episodio ${item.number}`}
                  >
                    <View className="flex-row items-center gap-4 px-4 py-4">
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest">
                        <Text className="text-xs font-semibold text-on-surface">{item.number}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-medium text-on-surface">
                          {`Episodio ${item.number}`}
                        </Text>
                        {hasProgress && (
                          <Text className="mt-0.5 text-xs text-on-surface-variant">
                            {pct >= 0.9 ? "Completado" : `Visto al ${Math.round(pct * 100)}%`}
                          </Text>
                        )}
                      </View>
                      <Feather name="play-circle" size={24} color={ACCENT_COLOR} />
                    </View>
                    {hasProgress && <ProgressBar progress={barProgress} duration={historyEntry.duration} />}
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>

          <AnimeEpisodeModal
            visible={!!selectedEpisode}
            onClose={() => setSelectedEpisode(null)}
            episode={selectedEpisode}
            servers={servers}
            isLoading={serverLoading}
            error={serverError}
            onRetry={retryServers}
            onServerSelect={handleServerSelect}
          />
        </Animated.View>
      )}
      {(keepSkeleton || !showContent) && (
        <Animated.View style={[StyleSheet.absoluteFill, skeletonStyle]}>
          <DetailSkeleton />
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
