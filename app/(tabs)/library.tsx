import { AnimeCard } from "@/components/AnimeCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { useFavoritesStore } from "@/stores/favoritesStore";
import { SCREEN_BOTTOM_PADDING, calcCardWidth } from "@/utils/layout";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { FlatList, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LibraryContent = React.memo(function LibraryContent() {
  const favorites = useFavoritesStore((s) => s.favorites);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);

  return (
    <View className="flex-1 bg-black">
      <View style={{ paddingTop: insets.top + 8 }}>
        <TopAppBar title="Biblioteca" />
      </View>
      {favorites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Feather name="bookmark" size={48} color="#404040" />
          <Text className="mt-4 text-sm font-semibold text-neutral-500">Tu biblioteca está vacía</Text>
          <Text className="mt-2 max-w-[280px] text-center text-xs text-neutral-600">
            Guardá animes con el marcador en su página para encontrarlos acá.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.url}
          numColumns={3}
          columnWrapperClassName="justify-start gap-3"
          renderItem={({ item }) => (
            <View className="mb-2">
              <AnimeCard anime={item} width={cardWidth} />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: SCREEN_BOTTOM_PADDING }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
});

export default function LibraryScreen() {
  return (
    <ErrorBoundary>
      <LibraryContent />
    </ErrorBoundary>
  );
}
