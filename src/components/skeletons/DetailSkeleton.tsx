import { useWindowDimensions, View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

export function DetailSkeleton() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const backdropHeight = windowHeight * 0.42;

  return (
    <View className="flex-1 bg-surface">
      <View style={{ height: backdropHeight, width: windowWidth }}>
        <Skeleton width="100%" height={backdropHeight} borderRadius={0} />

        <View className="absolute top-14 left-4 h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
          <Skeleton width={24} height={24} borderRadius={4} />
        </View>

        <View className="absolute inset-0 justify-end gap-3 px-4 pb-4">
          <Skeleton width="75%" height={28} borderRadius={6} />
          <View className="flex-row gap-2">
            <Skeleton width={90} height={24} borderRadius={12} />
            <Skeleton width={100} height={24} borderRadius={12} />
          </View>
          <View className="flex-row gap-1.5">
            <Skeleton width={64} height={24} borderRadius={12} />
            <Skeleton width={80} height={24} borderRadius={12} />
            <Skeleton width={52} height={24} borderRadius={12} />
          </View>
        </View>
      </View>

      <View className="gap-2 px-4 pt-5">
        <Skeleton width={70} height={14} borderRadius={4} />
        <Skeleton width="100%" height={14} borderRadius={4} />
        <Skeleton width="92%" height={14} borderRadius={4} />
        <Skeleton width="65%" height={14} borderRadius={4} />
      </View>

      <View className="gap-3 px-4 pt-6">
        <Skeleton width={140} height={14} borderRadius={4} />
        <View className="flex-row gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={`rel-${i}`} className="w-[100px]">
              <Skeleton width={100} height={140} borderRadius={12} />
              <Skeleton width="90%" height={12} borderRadius={4} className="mt-1.5" />
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between px-4 pt-6">
        <Skeleton width={130} height={16} borderRadius={4} />
        <Skeleton width={56} height={28} borderRadius={14} />
      </View>

      <View className="mt-3 gap-2 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`ep-${i}`} className="flex-row items-center gap-4 rounded-2xl bg-surface-container px-4 py-4">
            <Skeleton width={40} height={40} borderRadius={20} />
            <View className="flex-1">
              <Skeleton width={110} height={15} borderRadius={4} />
            </View>
            <Skeleton width={24} height={24} borderRadius={12} />
          </View>
        ))}
      </View>
    </View>
  );
}
