import { ACCENT_COLOR, ON_ACCENT_COLOR } from "@/config/source";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useMemo } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import type { AnimeDetail, AnimeRelations, RelatedAnime } from "@/types";
import { router } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ImageWithLoader } from "@/components/ui/ImageWithLoader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Button, IconButton } from "@/components/ui/Button";
import { useFavoritesStore } from "@/stores/favoritesStore";

interface AnimeDetailsHeaderProps {
  anime: AnimeDetail | null;
  relations: AnimeRelations | null;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  isAscending: boolean;
  toggleSort: () => void;
  insets: EdgeInsets;
  onBackPress?: () => void;
}

const TYPE_LABEL = { prequel: "Precuela", sequel: "Secuela" };

function FavoriteButton({ slug, title, image }: { slug: string; title: string; image: string }) {
  const isFavorite = useFavoritesStore((s) => s.favorites.some((f) => f.url === slug));
  const toggle = useFavoritesStore((s) => s.toggle);
  if (slug === "") return null;
  return (
    <Button
      label={isFavorite ? "En tu biblioteca" : "Guardar"}
      icon="bookmark"
      variant={isFavorite ? "tonal" : "filled"}
      onPress={() => { void toggle(slug, title, image); }}
      className="mr-4"
    />
  );
}

export const AnimeDetailsHeader = memo(
  ({
    anime,
    relations,
    isExpanded,
    setIsExpanded,
    isAscending,
    toggleSort,
    insets,
    onBackPress,
  }: AnimeDetailsHeaderProps) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const hasSynopsis = anime?.synopsis != null && anime.synopsis.length > 0;
    const statusLower = anime?.status.toLowerCase();
    const isAiring = statusLower != null && (statusLower.includes("emisión") || statusLower.includes("emision"));

    const relatedItems = useMemo(() => {
      if (relations == null) return null;
      const items: { anime: RelatedAnime; type: "prequel" | "sequel" | "related" }[] = [
        ...relations.prequel.map((a) => ({ anime: a, type: "prequel" as const })),
        ...relations.sequel.map((a) => ({ anime: a, type: "sequel" as const })),
        ...relations.related.map((a) => ({ anime: a, type: "related" as const })),
      ];
      return items.length > 0 ? items : null;
    }, [relations]);

    return (
      <>
        <View className="overflow-hidden" style={{ height: windowHeight * 0.42, width: windowWidth }}>
          <ImageWithLoader
            uri={anime?.banner ?? anime?.image ?? ''}
            className="absolute inset-0 h-full w-full rounded-none"
          />
          <LinearGradient
            colors={["rgba(20,18,24,0.30)", "rgba(20,18,24,0.10)", "rgba(20,18,24,0.62)", "rgba(20,18,24,0.98)"]}
            locations={[0.05, 0.35, 0.62, 1]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <View
              className="absolute left-2 flex-row items-center gap-1"
              style={{ top: insets.top + 4 }}
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-black/40">
                <IconButton icon="arrow-left" label="Volver" color="#FFFFFF" size={24} onPress={onBackPress ?? (() => {})} />
              </View>
            </View>

            <View className="flex-1 justify-end gap-3 px-4 pb-4">
              <Text className="text-3xl font-bold text-white" numberOfLines={2}>
                {anime?.title}
              </Text>

              <View className="flex-row items-center gap-2">
                <View className="rounded-full bg-black/50 px-3 py-1">
                  <Text className={`text-[11px] font-semibold ${isAiring ? "text-accent" : "text-on-surface-variant"}`}>
                    {isAiring ? "En emisión" : "Finalizado"}
                  </Text>
                </View>
                <View className="rounded-full bg-black/50 px-3 py-1">
                  <Text className="text-[11px] font-semibold text-on-surface-variant">
                    {anime?.episodes.length ?? 0} episodios
                  </Text>
                </View>
              </View>

              <View className="mt-1 flex-row items-center justify-between">
                <View className="flex-1 flex-row flex-wrap gap-1.5">
                  {anime?.genres?.map((genre) => (
                    <View key={genre} className="rounded-full border border-outline-variant px-3 py-1">
                      <Text className="text-[11px] text-on-surface">{genre}</Text>
                    </View>
                  ))}
                </View>
                <FavoriteButton
                  slug={anime?.url ?? ""}
                  title={anime?.title ?? ""}
                  image={anime?.image ?? ""}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="gap-2 px-4 pt-5">
          <SectionTitle>Sinopsis</SectionTitle>
          {hasSynopsis ? (
            <AnimatedPressable onPress={() => { setIsExpanded(!isExpanded); }}>
              <Text
                className="text-sm leading-6 text-on-surface-variant"
                numberOfLines={isExpanded ? undefined : 3}
              >
                {anime.synopsis}
              </Text>
              {!isExpanded && anime.synopsis.length > 150 && (
                <Text className="mt-2 text-sm font-semibold text-accent">Leer más</Text>
              )}
            </AnimatedPressable>
          ) : (
            <Text className="text-sm text-on-surface-variant">Sinopsis no disponible</Text>
          )}
        </View>

        {relatedItems != null && (
          <View className="gap-3 px-4 pt-6">
            <SectionTitle>Relacionados</SectionTitle>
            <FlashList
              horizontal
              data={relatedItems}
              keyExtractor={(item) => `${item.type}-${item.anime.id}`}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <AnimatedPressable
                  className="mr-3 w-[100px]"
                  onPress={() => router.replace(`/anime/${item.anime.slug}`)}
                >
                  <View className="relative">
                    <ImageWithLoader
                      uri={item.anime.poster}
                      style={{ width: 100, height: 140, borderRadius: 12 }}
                    />
                    {item.type !== "related" && (
                      <View className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: ACCENT_COLOR }}>
                        <Text className="text-[9px] font-bold" style={{ color: ON_ACCENT_COLOR }}>
                          {TYPE_LABEL[item.type]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="mt-1.5 text-xs text-on-surface" numberOfLines={2}>
                    {item.anime.name}
                  </Text>
                </AnimatedPressable>
              )}
            />
          </View>
        )}

        <View className="flex-row items-center justify-between px-4 pt-6">
          <SectionTitle>{`Episodios (${anime?.episodes.length ?? 0})`}</SectionTitle>
          <AnimatedPressable
            onPress={toggleSort}
            className="flex-row items-center gap-1 rounded-full bg-surface-container-high px-3 py-1.5"
            accessibilityLabel={isAscending ? "Ordenar descendente" : "Ordenar ascendente"}
          >
            <Feather name={isAscending ? "chevron-down" : "chevron-up"} size={16} color={ACCENT_COLOR} />
            <Text className="text-xs font-medium text-accent">{isAscending ? "1-N" : "N-1"}</Text>
          </AnimatedPressable>
        </View>
      </>
    );
  },
);

AnimeDetailsHeader.displayName = "AnimeDetailsHeader";
