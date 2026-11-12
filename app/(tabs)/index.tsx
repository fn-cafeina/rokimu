import { ContinueWatching } from "@/components/home/ContinueWatching";
import { AnimeGridSection } from "@/components/home/AnimeGridSection";
import { ErrorState } from "@/components/ui/ErrorState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";
import { useHomeScreen, type SectionItem } from "@/hooks/useHomeScreen";
import { SCREEN_BOTTOM_PADDING } from "@/utils/layout";
import { ACCENT_COLOR } from "@/config/source";
import React, { useEffect } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useCrossfade } from "@/hooks/useCrossfade";

const HomeContent = React.memo(function HomeContent() {
  const { sections, isLoading, error, view, fetchHome, hasContent } = useHomeScreen();
  const insets = useSafeAreaInsets();

  const { keepSkeleton, skeletonStyle, contentStyle } = useCrossfade(hasContent);

  useEffect(() => {
    void fetchHome();
  }, [fetchHome]);

  if (view === "error") {
    return <ErrorState error={error} onRetry={() => void fetchHome(true)} />;
  }

  return (
    <View className="flex-1 bg-black">
      {hasContent && (
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <FlatList
            data={sections}
            keyExtractor={(item: SectionItem, index: number) => `${item.type}-${index}`}
            renderItem={({ item }) => {
              if (item.type === "CONTINUE") return <ContinueWatching items={item.items} />;
              return <AnimeGridSection label={item.label} items={item.items} />;
            }}
            ItemSeparatorComponent={() => <View className="h-4" />}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: insets.top + 16,
              paddingBottom: SCREEN_BOTTOM_PADDING,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void fetchHome(true)} tintColor={ACCENT_COLOR} />}
          />
        </Animated.View>
      )}
      {(keepSkeleton || !hasContent) && (
        <Animated.View style={[StyleSheet.absoluteFill, skeletonStyle]}>
          <HomeSkeleton />
        </Animated.View>
      )}
    </View>
  );
});

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}
