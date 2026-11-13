import React, { memo, useEffect, useRef } from "react";
import { FlatList, Text, View } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import type { EpisodeRange } from "@/types";

const RANGE_BADGE_WIDTH = 96;
const RANGE_BADGE_GAP = 8;

interface EpisodeRangeSelectorProps {
  ranges: EpisodeRange[];
  activeRangeIdx: number;
  setActiveRangeIdx: (idx: number) => void;
  isRestoring: boolean;
}

/** Material 3 segmented button row for episode ranges. */
export const EpisodeRangeSelector = memo(({
  ranges, activeRangeIdx, setActiveRangeIdx, isRestoring
}: EpisodeRangeSelectorProps) => {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (ranges.length > 0 && listRef.current && !isRestoring) {
      const validIndex = Math.max(0, Math.min(activeRangeIdx, ranges.length - 1));
      if (validIndex !== activeRangeIdx) {
        return; // Don't scroll if index is invalid, let parent correct it
      }

      const timer = setTimeout(() => {
        if (listRef.current && validIndex < ranges.length) {
          listRef.current.scrollToIndex({
            index: validIndex,
            animated: true,
            viewPosition: 0.5,
          });
        }
      }, 100);
      return () => { clearTimeout(timer); };
    }
    return undefined;
  }, [activeRangeIdx, ranges.length, isRestoring]);

  if (ranges.length <= 1) return null;

  return (
    <View className="mt-4">
      <FlatList
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={ranges}
        keyExtractor={(item) => item.label}
        renderItem={({ item, index }) => {
          const isActive = activeRangeIdx === index;
          return (
            <AnimatedPressable
              onPress={() => { setActiveRangeIdx(index); }}
              hapticFeedback
              className={`h-10 items-center justify-center rounded-full px-4 ${
                isActive ? "bg-primary-container" : "border border-outline-variant"
              }`}
              style={{ width: RANGE_BADGE_WIDTH }}
              accessibilityLabel={`Rango ${item.label}`}
            >
              <Text className={`text-xs font-medium ${isActive ? "text-on-primary-container" : "text-on-surface"}`}>
                {item.label}
              </Text>
            </AnimatedPressable>
          );
        }}
        contentContainerClassName="gap-2 px-4"
        getItemLayout={(_, index) => ({
          length: RANGE_BADGE_WIDTH,
          offset: (RANGE_BADGE_WIDTH + RANGE_BADGE_GAP) * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
      />
    </View>
  );
});

EpisodeRangeSelector.displayName = "EpisodeRangeSelector";
