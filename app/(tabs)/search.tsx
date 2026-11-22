import { AnimeCard } from "@/components/anime/AnimeCard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { GridSkeleton } from "@/components/search/GridSkeleton";
import { FilterSheet } from "@/components/search/FilterSheet";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Anime } from "@/types";
import { useSearchScreen } from "@/hooks/useSearchScreen";
import { EMPTY_FILTER, useCatalogStore, type BrowseFilter } from "@/stores/catalogStore";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/theme";
import { genreLabel } from "@/config/browse";
import { deriveView } from "@/utils/resource";
import { TAB_BAR_OFFSET, calcCardWidth } from "@/utils/layout";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** What the filter button shows: the active dimension, or nothing */
function filterLabel(filter: BrowseFilter): string | null {
  if (filter.genre != null) return genreLabel(filter.genre);
  if (filter.year != null) return String(filter.year);
  return null;
}

function SearchScreenContent() {
  const { searchTerm, searchAnimes, isLoading, isPending, error, hasQuery, handleTextChange, resetSearch, retrySearch } = useSearchScreen();

  // The catalog is the discover feed when nothing is typed: /directorio, no query
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const loadMore = useCatalogStore((s) => s.loadMore);
  const setFilter = useCatalogStore((s) => s.setFilter);
  const filter = useCatalogStore((s) => s.filter);
  const catalogPath = useCatalogStore((s) => s.path);
  const catalog = useCatalogStore((s) => s.items);
  const isLoadingMore = useCatalogStore((s) => s.isLoadingMore);
  const homeResource = useCatalogStore((s) => s.resource);
  const catalogView = deriveView(homeResource, catalogPath);
  const catalogError = homeResource.status === "error" ? homeResource.error : null;

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);
  const listRef = useRef<FlatList<Anime>>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeLabel = filterLabel(filter);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [hasQuery, catalogPath]);

  const renderCard = useCallback(({ item }: { item: Anime }) => (
    <View className="mb-3"><AnimeCard anime={item} width={cardWidth} /></View>
  ), [cardWidth]);

  const handleSelectFilter = useCallback((next: BrowseFilter) => {
    setFilter(next);
    setFilterOpen(false);
  }, [setFilter]);

  const handleEndReached = useCallback(() => {
    if (hasQuery) return;
    void loadMore();
  }, [hasQuery, loadMore]);

  const grid = hasQuery ? searchAnimes : catalog;
  const gridLoading = hasQuery ? isPending && grid.length === 0 : catalogView === "skeleton";
  const gridFailed = hasQuery ? error != null && grid.length === 0 : catalogView === "error";

  return (
    <View className="flex-1 bg-black">
      <View className="px-5 pb-4" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center h-12 bg-neutral-900 rounded-xl border border-neutral-800 px-4">
          <Feather name="search" size={18} color={MUTED_ICON} style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 text-white text-base font-normal h-12"
            placeholder="Buscar anime..."
            placeholderTextColor={MUTED_ICON}
            value={searchTerm}
            onChangeText={handleTextChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <Feather name="x" size={16} color={MUTED_ICON} onPress={resetSearch} style={{ padding: 8 }} />
          )}
        </View>

        {/* Filters only pick a browse path: the site has no URL that combines
            them with a text query, so they stay out of the way while searching */}
        {!hasQuery && (
          <View className="flex-row items-center mt-3">
            <AnimatedPressable
              onPress={() => setFilterOpen(true)}
              accessibilityLabel="Filtrar por género o año"
              className={`flex-row items-center rounded-full border px-3 py-1.5 ${activeLabel != null ? "bg-neutral-800 border-neutral-600" : "bg-neutral-900 border-neutral-800"}`}
            >
              <Feather name="sliders" size={12} color={activeLabel != null ? ACCENT_COLOR : MUTED_ICON} />
              <Text className={`text-xs ml-2 ${activeLabel != null ? "text-white" : "text-neutral-400"}`}>
                {activeLabel ?? "Filtros"}
              </Text>
            </AnimatedPressable>
            {activeLabel != null && (
              <Feather name="x" size={14} color={MUTED_ICON} onPress={() => setFilter(EMPTY_FILTER)} style={{ padding: 8 }} />
            )}
          </View>
        )}
      </View>

      <View className="flex-1 bg-black px-5">
        {gridLoading && <GridSkeleton />}
        {!gridLoading && gridFailed && (
          hasQuery ? (
            <ErrorState title="No se pudo buscar" error={error} onRetry={retrySearch} />
          ) : (
            <ErrorState title="No se pudo cargar el catálogo" error={catalogError} onRetry={() => void fetchCatalog(true)} />
          )
        )}
        {!gridLoading && !gridFailed && (
          <FlatList
            ref={listRef}
            data={grid}
            keyExtractor={(item: Anime) => item.url}
            numColumns={3}
            renderItem={renderCard}
            columnWrapperClassName="gap-3"
            contentContainerStyle={{ paddingTop: 4, paddingBottom: TAB_BAR_OFFSET + insets.bottom, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              !hasQuery && isLoadingMore ? (
                <View className="py-4 items-center">
                  <ActivityIndicator color={ACCENT_COLOR} />
                </View>
              ) : undefined
            }
            refreshControl={
              <RefreshControl
                refreshing={hasQuery ? isLoading : homeResource.status === "loading"}
                onRefresh={hasQuery ? retrySearch : () => void fetchCatalog(true)}
                tintColor={ACCENT_COLOR}
                colors={[ACCENT_COLOR]}
              />
            }
            ListEmptyComponent={
              hasQuery ? (
                <EmptyState
                  icon="search"
                  title={`Sin resultados para «${searchTerm.trim()}»`}
                  subtitle="Probá con otro término."
                />
              ) : (
                <EmptyState icon="book-open" title="Catálogo vacío" subtitle="No hay animes para mostrar." />
              )
            }
          />
        )}
      </View>

      <FilterSheet
        visible={filterOpen && !hasQuery}
        filter={filter}
        onClose={() => setFilterOpen(false)}
        onSelect={handleSelectFilter}
      />
    </View>
  );
}

export default function SearchScreen() {
  return (
    <ErrorBoundary>
      <SearchScreenContent />
    </ErrorBoundary>
  );
}
