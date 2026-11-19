import { AnimeCard } from "@/components/AnimeCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GridSkeleton } from "@/components/skeletons/GridSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Anime } from "@/types";
import { useSearchScreen } from "@/hooks/useSearchScreen";
import { useTabBarManager } from "@/hooks/useTabBarManager";
import { HOME_KEY, useHomeStore } from "@/stores/homeStore";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/theme";
import { deriveView } from "@/utils/resource";
import { TAB_BAR_OFFSET, calcCardWidth } from "@/utils/layout";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { FlatList, RefreshControl, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMPTY_CATALOG: Anime[] = [];

function SearchScreenContent() {
  const { searchTerm, searchAnimes, isLoading, isPending, error, hasQuery, handleTextChange, resetSearch, retrySearch } = useSearchScreen();

  // The catalog is the discover feed when nothing is typed: /directorio, no query
  const fetchHome = useHomeStore((s) => s.fetchHome);
  const homeResource = useHomeStore((s) => s.resource);
  const catalog = homeResource.data?.recent ?? EMPTY_CATALOG;
  const catalogView = deriveView(homeResource, HOME_KEY);
  const catalogError = homeResource.status === "error" ? homeResource.error : null;

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);
  const { handleScroll, reset } = useTabBarManager({ threshold: 8 });
  const listRef = useRef<FlatList<Anime>>(null);

  useEffect(() => {
    void fetchHome();
  }, [fetchHome]);

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [hasQuery]);

  const renderCard = useCallback(({ item }: { item: Anime }) => (
    <View className="mb-3"><AnimeCard anime={item} width={cardWidth} /></View>
  ), [cardWidth]);

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
      </View>

      <View className="flex-1 bg-black px-5">
        {gridLoading && <GridSkeleton />}
        {!gridLoading && gridFailed && (
          hasQuery ? (
            <ErrorState title="No se pudo buscar" error={error} onRetry={retrySearch} />
          ) : (
            <ErrorState title="No se pudo cargar el catálogo" error={catalogError} onRetry={() => void fetchHome(true)} />
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
            contentContainerStyle={{ paddingTop: 4, paddingBottom: TAB_BAR_OFFSET, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={hasQuery ? retrySearch : () => void fetchHome(true)}
                tintColor={ACCENT_COLOR}
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
