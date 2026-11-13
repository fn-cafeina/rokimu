import { useWindowDimensions, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { calcCardWidth, CARD_WIDTH_CONFIG } from "@/utils/layout";

interface PosterGridSkeletonProps {
  rows?: number;
}

/** Placeholder for the 3-column poster grid, used by explore and search. */
export function PosterGridSkeleton({ rows = 3 }: PosterGridSkeletonProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = calcCardWidth(screenWidth);
  const cardHeight = cardWidth * 1.4;

  return (
    <View className="flex-row flex-wrap gap-3">
      {Array.from({ length: rows * CARD_WIDTH_CONFIG.columns }).map((_, idx) => (
        <View key={`card-${idx}`} style={{ width: cardWidth }}>
          <Skeleton width={cardWidth} height={cardHeight} borderRadius={12} />
          <View className="mt-2 gap-1">
            <Skeleton width="85%" height={13} borderRadius={4} />
            <Skeleton width="55%" height={11} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}
