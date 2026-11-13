import { AnimeGrid } from "@/components/ui/AnimeGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { useFavoritesStore } from "@/stores/favoritesStore";
import React from "react";
import { View } from "react-native";

const LibraryContent = React.memo(function LibraryContent() {
  const favorites = useFavoritesStore((s) => s.favorites);

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar title="Biblioteca" />
      <AnimeGrid
        data={favorites}
        empty={
          <EmptyState
            icon="bookmark"
            title="Tu biblioteca está vacía"
            description="Guardá animes con el marcador en su página para encontrarlos acá."
          />
        }
      />
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
