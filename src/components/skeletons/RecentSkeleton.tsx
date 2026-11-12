import { useWindowDimensions, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { calcCardWidth, CARD_WIDTH_CONFIG } from "@/utils/layout";

/** Skeleton of the "Recién agregados" grid shown while Explore is idle */
export function RecentSkeleton() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);
  const cardHeight = cardWidth * 1.4;

  return (
    <View>
      <Skeleton width={160} height={14} borderRadius={4} />
      <View className="mb-3" />
      <View className="gap-3">
        {Array.from({ length: 2 }).map((_, rowIdx) => (
          <View key={`row-${rowIdx}`} className="flex-row gap-3">
            {Array.from({ length: CARD_WIDTH_CONFIG.columns }).map((_, colIdx) => (
              <View key={`card-${rowIdx}-${colIdx}`} style={{ width: cardWidth }}>
                <Skeleton width={cardWidth} height={cardHeight} borderRadius={8} />
                <View className="mt-2 gap-1">
                  <Skeleton width="85%" height={13} borderRadius={4} />
                  <Skeleton width="55%" height={11} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
