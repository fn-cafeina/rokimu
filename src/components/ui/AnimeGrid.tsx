import React, { useCallback } from "react";
import { FlatList, RefreshControl, type ListRenderItem, useWindowDimensions, View } from "react-native";
import { AnimeCard } from "@/components/AnimeCard";
import { ACCENT_COLOR } from "@/config/source";
import { SCREEN_BOTTOM_PADDING, calcCardWidth, CARD_WIDTH_CONFIG } from "@/utils/layout";

export interface GridItem {
  title: string;
  image: string;
  url: string;
}

interface AnimeGridProps<T extends GridItem> {
  data: T[];
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Rendered above the first row, inside the scroll area */
  header?: React.ReactElement;
  empty?: React.ReactElement;
}

/** The only 3-column poster grid in the app: explore, results and library. */
export function AnimeGrid<T extends GridItem>({
  data,
  onRefresh,
  refreshing = false,
  header,
  empty,
}: AnimeGridProps<T>) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);

  const renderItem = useCallback<ListRenderItem<T>>(
    ({ item }) => (
      <View style={{ width: cardWidth, marginBottom: CARD_WIDTH_CONFIG.gap }}>
        <AnimeCard anime={item} width={cardWidth} />
      </View>
    ),
    [cardWidth],
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.url}
      numColumns={CARD_WIDTH_CONFIG.columns}
      renderItem={renderItem}
      columnWrapperClassName="justify-start gap-3"
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{
        paddingHorizontal: CARD_WIDTH_CONFIG.horizontalPad,
        paddingTop: 12,
        paddingBottom: SCREEN_BOTTOM_PADDING,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh != null ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_COLOR} />
        ) : undefined
      }
    />
  );
}
