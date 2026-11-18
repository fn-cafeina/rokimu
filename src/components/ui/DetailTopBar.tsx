import type { Anime } from "@/types";
import { useSavedStore } from "@/stores/savedStore";
import { ACCENT_COLOR } from "@/config/source";
import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/AnimatedPressable";

interface DetailTopBarProps {
  anime: Anime | null;
  onBack: () => void;
}

/**
 * Pinned above the detail content so back and bookmark stay usable while the
 * skeleton is on screen, the way inkuru keeps its top bar.
 */
export function DetailTopBar({ anime, onBack }: DetailTopBarProps) {
  const insets = useSafeAreaInsets();
  const saved = useSavedStore((s) => s.saved);
  const isSaved = anime != null && saved.some((item) => item.url === anime.url);

  return (
    <View className="flex-row items-center px-2 py-1" style={{ marginTop: insets.top }}>
      <AnimatedPressable
        onPress={onBack}
        accessibilityLabel="Volver"
        hitSlop={8}
        className="min-h-12 min-w-12 items-center justify-center rounded-full"
      >
        <Feather name="arrow-left" size={24} color="#FFFFFF" />
      </AnimatedPressable>
      <View className="flex-1" />
      <AnimatedPressable
        disabled={anime == null && !isSaved}
        onPress={() => {
          if (anime == null) return;
          void useSavedStore.getState().toggleSaved({
            title: anime.title,
            image: anime.image,
            url: anime.url,
            status: anime.status,
          });
        }}
        accessibilityLabel={isSaved ? "Quitar de la biblioteca" : "Guardar en la biblioteca"}
        accessibilityState={{ selected: isSaved }}
        hitSlop={8}
        hapticFeedback={true}
        className="min-h-12 min-w-12 items-center justify-center rounded-full"
      >
        <Feather name="bookmark" size={24} color={isSaved ? ACCENT_COLOR : "#FFFFFF"} />
      </AnimatedPressable>
    </View>
  );
}
