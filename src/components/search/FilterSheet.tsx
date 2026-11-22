import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { GENRES, YEARS } from "@/config/browse";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/theme";
import type { BrowseFilter } from "@/stores/catalogStore";

interface FilterSheetProps {
  visible: boolean;
  filter: BrowseFilter;
  onClose: () => void;
  onSelect: (filter: BrowseFilter) => void;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-3 py-1.5 mb-2 mr-2 ${active ? "bg-neutral-800 border-neutral-600" : "bg-neutral-900 border-neutral-800"}`}
    >
      <Text className={`text-xs font-medium ${active ? "text-white" : "text-neutral-400"}`}>{label}</Text>
    </AnimatedPressable>
  );
}

/**
 * One dimension at a time: the source site serves genre and year as separate
 * paths and ignores the other as a param, so picking one clears the other.
 */
export function FilterSheet({ visible, filter, onClose, onSelect }: FilterSheetProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const hasFilter = filter.genre != null || filter.year != null;

  return (
    <View className="absolute inset-0 bg-black/80 justify-end">
      <Pressable className="absolute inset-0" onPress={onClose} />

      <View className="bg-neutral-900 rounded-t-xl px-5 pt-5" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-white text-xl font-bold">Explorar</Text>
          <Feather name="x" size={20} color={MUTED_ICON} onPress={onClose} style={{ padding: 4 }} />
        </View>
        <Text className="text-neutral-500 text-xs mb-4">
          El sitio no combina género y año: elegir uno quita el otro.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-neutral-400 text-xs uppercase tracking-wider">Género</Text>
            {filter.genre != null && (
              <Feather name="x-circle" size={14} color={MUTED_ICON} onPress={() => onSelect({ genre: null, year: filter.year })} />
            )}
          </View>
          <View className="flex-row flex-wrap mb-4">
            {GENRES.map((genre) => (
              <Chip
                key={genre.slug}
                label={genre.label}
                active={filter.genre === genre.slug}
                onPress={() => onSelect({ genre: filter.genre === genre.slug ? null : genre.slug, year: null })}
              />
            ))}
          </View>

          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-neutral-400 text-xs uppercase tracking-wider">Año</Text>
            {filter.year != null && (
              <Feather name="x-circle" size={14} color={MUTED_ICON} onPress={() => onSelect({ genre: filter.genre, year: null })} />
            )}
          </View>
          <View className="flex-row flex-wrap">
            {YEARS.map((year) => (
              <Chip
                key={year}
                label={String(year)}
                active={filter.year === year}
                onPress={() => onSelect({ genre: null, year: filter.year === year ? null : year })}
              />
            ))}
          </View>
        </ScrollView>

        {hasFilter && (
          <AnimatedPressable
            onPress={() => onSelect({ genre: null, year: null })}
            className="mt-4 flex-row items-center justify-center rounded-xl border border-neutral-800 py-3"
          >
            <Feather name="rotate-ccw" size={14} color={ACCENT_COLOR} />
            <Text className="text-white text-sm ml-2">Quitar filtro</Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}
