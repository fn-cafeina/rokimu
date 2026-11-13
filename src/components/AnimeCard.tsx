import React, { memo, useCallback } from "react";
import { View, Text } from "react-native";
import { navigateToAnime } from "@/utils/navigation";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ImageWithLoader } from "@/components/ui/ImageWithLoader";

/** Anything a poster card can render: Anime, Favorite and HistoryItem all satisfy it. */
export interface AnimeCardItem {
  title: string;
  image: string;
  url: string;
}

interface AnimeCardProps {
  anime: AnimeCardItem;
  width: number;
  onPress?: () => void;
}

export const AnimeCard = memo(function AnimeCard({ anime, width, onPress }: AnimeCardProps) {
  const cardHeight = width * 1.4;

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      navigateToAnime(anime.url);
    }
  }, [onPress, anime.url]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[{ width }]}
      accessibilityLabel={`Anime: ${anime.title}`}
      accessibilityHint="Presiona para ver detalles"
      hapticFeedback={true}
    >
      <View className="relative">
        <ImageWithLoader
          uri={anime.image}
          style={[{ width, height: cardHeight } as import("react-native").ImageStyle]}
        />
      </View>
      <Text className="mt-2 text-sm font-medium text-on-surface" numberOfLines={2}>
        {anime.title}
      </Text>
    </AnimatedPressable>
  );
});
