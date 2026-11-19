import { ACCENT_COLOR } from "@/config/source";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import type { AnimeDetail, AnimeRelations, Episode, RelatedAnime } from "@/types";
import { router } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ImageWithLoader } from "@/components/ui/ImageWithLoader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { COVER_ASPECT_RATIO } from "@/utils/layout";

interface AnimeDetailsHeaderProps {
  anime: AnimeDetail | null;
  relations: AnimeRelations | null;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  isAscending: boolean;
  toggleSort: () => void;
  /** Episode the detail CTA opens; null hides the button. */
  ctaEpisode: Episode | null;
  /** True when the CTA continues a series already started. */
  continuing: boolean;
  onResume: (episode: Episode) => void;
  watchedCount: number;
}

const TYPE_LABEL = { prequel: "Precuela", sequel: "Secuela" };

// Matches inkuru: the button reads "Ver más" until the text is short enough to fit.
const SYNOPSIS_LONG_LENGTH = 280;

export const AnimeDetailsHeader = memo(
  ({
    anime,
    relations,
    isExpanded,
    setIsExpanded,
    isAscending,
    toggleSort,
    ctaEpisode,
    continuing,
    onResume,
    watchedCount,
  }: AnimeDetailsHeaderProps) => {
    const hasSynopsis = anime?.synopsis != null && anime.synopsis.length > 0;
    const longSynopsis = hasSynopsis && anime.synopsis.length > SYNOPSIS_LONG_LENGTH;
    const statusLower = anime?.status.toLowerCase();
    const isAiring = statusLower != null && (statusLower.includes("emisión") || statusLower.includes("emision"));

    const totalEpisodes = anime?.episodes.length ?? 0;
    const progressPct = totalEpisodes > 0 ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100)) : 0;

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
        <View className="flex-row px-5">
          <View
            className="overflow-hidden rounded-2xl bg-neutral-800"
            style={{ width: "34%", aspectRatio: COVER_ASPECT_RATIO }}
          >
            <ImageWithLoader
              uri={anime?.image ?? ""}
              style={{ width: "100%", height: "100%", borderRadius: 16 }}
            />
          </View>
          <View className="ml-4 flex-1">
            <Text
              accessibilityRole="header"
              numberOfLines={4}
              className="text-2xl font-extrabold tracking-tight text-white"
            >
              {anime?.title}
            </Text>
            {/* Empty status means the parser found none; claiming a state would be wrong */}
            {(anime?.status ?? "") !== "" && (
              <View
                className={`mt-2 self-start rounded-lg px-2.5 py-1 ${isAiring ? "bg-accent/15" : "bg-neutral-800"}`}
              >
                <Text
                  className={`text-[11px] font-bold uppercase tracking-wider ${isAiring ? "text-accent" : "text-neutral-400"}`}
                >
                  {isAiring ? "En emisión" : "Finalizado"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {anime?.genres != null && anime.genres.length > 0 && (
          <View className="mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 px-5">
              {anime.genres.map((genre) => (
                <View key={genre} className="rounded-md bg-white/10 px-2.5 py-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                    {genre}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {ctaEpisode != null && (
          <View className="mt-4 px-5">
            <AnimatedPressable
              accessibilityRole="button"
              onPress={() => { onResume(ctaEpisode); }}
              className="min-h-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              <Text className="text-sm font-semibold text-neutral-950">
                {continuing ? `Continuar Episodio ${ctaEpisode.number}` : "Ver primer episodio"}
              </Text>
            </AnimatedPressable>
          </View>
        )}

        {watchedCount > 0 && totalEpisodes > 0 && (
          <View className="mt-4 px-5">
            <View className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
              <View
                className="h-full rounded-full"
                style={{ width: `${progressPct}%`, backgroundColor: ACCENT_COLOR }}
              />
            </View>
            <Text className="mt-1.5 text-xs text-neutral-400">
              {`${watchedCount} de ${totalEpisodes} episodios vistos`}
            </Text>
          </View>
        )}

        {hasSynopsis ? (
          <View className="mt-6 px-5">
            <SectionTitle>Sinopsis</SectionTitle>
            <AnimatedPressable
              accessibilityRole="button"
              className="mt-3"
              onPress={() => { setIsExpanded(!isExpanded); }}
            >
              <Text
                className="text-sm font-medium leading-6 text-neutral-400"
                numberOfLines={!isExpanded && longSynopsis ? 6 : undefined}
              >
                {anime.synopsis}
              </Text>
              {longSynopsis && (
                <Text className="mt-2 text-sm font-bold leading-6 text-accent">
                  {isExpanded ? "Ver menos" : "Ver más"}
                </Text>
              )}
            </AnimatedPressable>
          </View>
        ) : (
          <View className="mt-6 px-5">
            <SectionTitle>Sinopsis</SectionTitle>
            <Text className="mt-3 text-[10px] font-semibold tracking-wider leading-none text-neutral-400">
              Sinopsis no disponible
            </Text>
          </View>
        )}

        {relatedItems != null && (
          <View className="pt-6 px-5">
            <SectionTitle>Relacionados</SectionTitle>
            <View className="mt-3">
              <FlashList
                horizontal
                data={relatedItems}
                keyExtractor={(item) => `${item.type}-${item.anime.id}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <AnimatedPressable
                    className="w-[100px] mr-3"
                    onPress={() => router.replace(`/anime/${item.anime.slug}`)}
                  >
                    <View className="relative">
                      <ImageWithLoader
                        uri={item.anime.poster}
                        style={{ width: 100, height: 140, borderRadius: 10 }}
                      />
                      {item.type !== "related" && (
                        <View className="absolute top-1.5 left-1.5 rounded-md bg-accent px-1.5 py-0.5">
                          <Text className="text-[9px] font-bold text-neutral-950 uppercase">
                            {TYPE_LABEL[item.type]}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="mt-1 text-xs font-medium text-neutral-300" numberOfLines={2}>
                      {item.anime.name}
                    </Text>
                  </AnimatedPressable>
                )}
              />
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between px-5 pt-6">
          <SectionTitle>{`Episodios (${totalEpisodes})`}</SectionTitle>
          <AnimatedPressable
            onPress={toggleSort}
            accessibilityLabel={isAscending ? "Ordenar episodios: más recientes primero" : "Ordenar episodios: más antiguos primero"}
            hitSlop={4}
            className="min-h-12 min-w-12 items-center justify-center"
          >
            <Feather
              name={isAscending ? "chevron-up" : "chevron-down"}
              size={20}
              color={ACCENT_COLOR}
            />
          </AnimatedPressable>
        </View>
      </>
    );
  },
);

AnimeDetailsHeader.displayName = "AnimeDetailsHeader";
