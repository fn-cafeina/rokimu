import { AnimeCard } from "@/components/AnimeCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useTabBarManager } from "@/hooks/useTabBarManager";
import { useSavedStore } from "@/stores/savedStore";
import type { Anime } from "@/types";
import { TAB_BAR_OFFSET, calcCardWidth } from "@/utils/layout";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function LibraryContent() {
  const saved = useSavedStore((s) => s.saved);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);
  const { handleScroll, reset } = useTabBarManager({ threshold: 8 });

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  const renderItem = useCallback(({ item }: { item: Anime }) => (
    <View className="mb-3"><AnimeCard anime={item} width={cardWidth} /></View>
  ), [cardWidth]);

  return (
    <View className="flex-1 bg-black">
      {saved.length > 0 && (
        <View className="px-5 pb-3" style={{ paddingTop: insets.top + 16 }}>
          <SectionTitle>Biblioteca</SectionTitle>
        </View>
      )}
      <FlatList
        data={saved}
        keyExtractor={(item: Anime) => item.url}
        numColumns={3}
        renderItem={renderItem}
        columnWrapperClassName="gap-3"
        contentContainerClassName="px-5"
        contentContainerStyle={{ paddingTop: saved.length > 0 ? 4 : insets.top + 16, paddingBottom: TAB_BAR_OFFSET + insets.bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark"
            title="Biblioteca vacía"
            subtitle="Guardá un anime desde su detalle para retomarlo aquí."
          />
        }
      />
    </View>
  );
}

export default function LibraryScreen() {
  return (
    <ErrorBoundary>
      <LibraryContent />
    </ErrorBoundary>
  );
}
