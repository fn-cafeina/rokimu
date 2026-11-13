import { AnimeGrid } from "@/components/ui/AnimeGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { PosterGridSkeleton } from "@/components/skeletons/PosterGridSkeleton";
import { useExploreScreen } from "@/hooks/useExploreScreen";
import { useSearchScreen, MIN_SEARCH_LENGTH } from "@/hooks/useSearchScreen";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/source";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Text, TextInput, View } from "react-native";

function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    // Material 3 search bar: 56dp, full corner, surface container high
    <View className="mx-4 h-14 flex-row items-center gap-3 rounded-full bg-surface-container-high px-4">
      <Feather name="search" size={20} color={MUTED_ICON} />
      <TextInput
        className="h-14 flex-1 text-base text-on-surface"
        placeholder="Buscar anime"
        placeholderTextColor={MUTED_ICON}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Buscar anime"
      />
      {value.length > 0 && (
        <AnimatedPressable
          onPress={onClear}
          className="h-10 w-10 items-center justify-center rounded-full"
          accessibilityLabel="Borrar búsqueda"
        >
          <Feather name="x" size={18} color={MUTED_ICON} />
        </AnimatedPressable>
      )}
    </View>
  );
}

function ExploreScreenContent() {
  const {
    searchTerm, searchAnimes, isLoading, error,
    isIdle, isTyping, isSearched, handleSearch, handleTextChange, resetSearch, retrySearch,
  } = useSearchScreen();

  const { items, isLoading: homeLoading, error: homeError, fetchHome, hasContent } = useExploreScreen();

  useEffect(() => {
    if (isIdle) void fetchHome();
  }, [isIdle, fetchHome]);

  // Three states, never overlapping: exploring, typing, or showing results.
  const showResults = isSearched;
  const showExplore = isIdle || isTyping;

  const submit = () => { handleSearch(searchTerm); };

  // The grid draws its own empty slot, so the skeleton and the error state are
  // chosen here instead of stacking over the list
  const exploreEmpty: React.ReactElement | undefined =
    homeError != null ? (
      <EmptyState
        icon="wifi-off"
        title="No se pudo cargar el catálogo"
        description="Revisa tu conexión y vuelve a intentarlo."
        actionLabel="Reintentar"
        actionIcon="refresh-cw"
        onAction={() => void fetchHome(true)}
      />
    ) : homeLoading ? (
      <PosterGridSkeleton />
    ) : undefined;

  const resultsEmpty: React.ReactElement | undefined = isLoading ? (
    <PosterGridSkeleton rows={3} />
  ) : error != null ? (
    <EmptyState
      icon="alert-circle"
      title="No se pudieron cargar los resultados"
      description="El sitio está tardando más de lo normal. Inténtalo de nuevo en un momento."
      actionLabel="Reintentar"
      actionIcon="refresh-cw"
      onAction={retrySearch}
    />
  ) : (
    <EmptyState
      icon="search"
      title="Sin resultados"
      description={`No encontramos nada para "${searchTerm}".`}
    />
  );

  return (
    <View className="flex-1 bg-surface">
      <TopAppBar title="Explorar" />
      <View className="pb-3">
        <SearchBar
          value={searchTerm}
          onChangeText={handleTextChange}
          onSubmit={submit}
          onClear={resetSearch}
        />
      </View>

      {showExplore && (
        <AnimeGrid
          data={items}
          onRefresh={() => void fetchHome(true)}
          refreshing={homeLoading && hasContent}
          empty={exploreEmpty}
        />
      )}

      {showExplore && isTyping && (
        <View className="px-4 pb-2">
          <Text className="text-xs text-on-surface-variant">
            {searchTerm.trim().length >= MIN_SEARCH_LENGTH
              ? "Presioná buscar para ver resultados"
              : `Escribí al menos ${MIN_SEARCH_LENGTH} caracteres`}
          </Text>
        </View>
      )}

      {showResults && (
        <AnimeGrid
          data={searchAnimes}
          onRefresh={retrySearch}
          refreshing={isLoading}
          empty={resultsEmpty}
        />
      )}

      {showResults && (
        <AnimatedPressable
          onPress={resetSearch}
          className="absolute bottom-6 right-4 flex-row items-center gap-2 rounded-full bg-surface-container-high px-4 py-3"
          accessibilityLabel="Volver al catálogo"
        >
          <Feather name="arrow-left" size={16} color={ACCENT_COLOR} />
          <Text className="text-xs font-medium text-accent">Catálogo</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

export default function SearchScreen() {
  return (
    <ErrorBoundary>
      <ExploreScreenContent />
    </ErrorBoundary>
  );
}
