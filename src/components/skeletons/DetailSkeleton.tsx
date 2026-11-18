import type { ReactNode } from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { COVER_ASPECT_RATIO } from "@/utils/layout";

/** Mirrors the poster hero: cover, title, status, tags, resume button, heading.
 * `topBar` scrolls with the content, so it is rendered inside the skeleton. */
export function DetailSkeleton({ topBar }: { topBar?: ReactNode }) {
  return (
    <View className="flex-1 bg-black">
      {topBar}
      <View className="flex-row px-5">
        <View className="overflow-hidden rounded-2xl" style={{ width: "34%", aspectRatio: COVER_ASPECT_RATIO }}>
          <Skeleton width="100%" height="100%" borderRadius={16} />
        </View>
        <View className="ml-4 flex-1">
          <Skeleton width="90%" height={24} borderRadius={4} />
          <Skeleton width="60%" height={24} borderRadius={4} className="mt-2" />
          <Skeleton width={80} height={22} borderRadius={8} className="mt-2" />
        </View>
      </View>

      <View className="mt-4 flex-row gap-1.5 px-5">
        <Skeleton width={60} height={22} borderRadius={6} />
        <Skeleton width={80} height={22} borderRadius={6} />
        <Skeleton width={50} height={22} borderRadius={6} />
      </View>

      <View className="mt-4 px-5">
        <Skeleton width="100%" height={56} borderRadius={12} />
      </View>

      <View className="mt-6 px-5 gap-2">
        <Skeleton width={60} height={14} borderRadius={4} />
        <View className="gap-1.5">
          <Skeleton width="100%" height={14} borderRadius={4} />
          <Skeleton width="92%" height={14} borderRadius={4} />
          <Skeleton width="65%" height={14} borderRadius={4} />
        </View>
      </View>

      <View className="mt-6 px-5">
        <Skeleton width={160} height={14} borderRadius={4} />
        <View className="flex-row gap-3 mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={`rel-${i}`} className="w-[100px]">
              <Skeleton width={100} height={140} borderRadius={10} />
              <Skeleton width="90%" height={12} borderRadius={4} className="mt-1" />
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between px-5 pt-6">
        <Skeleton width={130} height={16} borderRadius={4} />
        <Skeleton width={20} height={20} borderRadius={4} />
      </View>

      <View className="flex-row gap-3 px-5 mt-3 mb-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={`tab-${i}`} width={80} height={32} borderRadius={8} />
        ))}
      </View>

      <View className="px-5 mt-1 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={`ep-${i}`}
            className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden"
          >
            <View className="flex-row items-center justify-between p-4">
              <Skeleton width={100} height={15} borderRadius={4} />
              <Skeleton width={16} height={16} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
