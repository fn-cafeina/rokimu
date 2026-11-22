import { Feather } from "@expo/vector-icons";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { memo, useCallback, useEffect } from "react";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import {
  BROWSE_STATUSES,
  BROWSE_TYPES,
  GENRES,
  YEARS,
  type BrowseFilter,
  type BrowseOption,
} from "@/config/browse";
import { MUTED_ICON } from "@/config/theme";
import { useCatalogStore } from "@/stores/catalogStore";

// memo + stable onSelect: a tap re-renders only the two chips whose active
// flag flips, not the ~106 Reanimated chips the sheet mounts
const Chip = memo(function Chip({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: string;
  active: boolean;
  onSelect: (value: string | null) => void;
}) {
  return (
    <AnimatedPressable
      // Tapping the active value clears it, so one tap both picks and undoes
      onPress={() => onSelect(active ? null : value)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-3 py-1.5 mb-2 mr-2 ${active ? "bg-neutral-800 border-neutral-600" : "bg-neutral-900 border-neutral-800"}`}
    >
      <Text className={`text-xs font-medium ${active ? "text-white" : "text-neutral-400"}`}>{label}</Text>
    </AnimatedPressable>
  );
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-3">
      <Text className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-2">{title}</Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}

function Options({
  options,
  selected,
  onSelect,
}: {
  options: BrowseOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          value={option.value}
          active={selected === option.value}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/**
 * Root-level sheet: it mounts above the tab navigator (like UpdateModal) so the
 * floating tab bar can never draw over it.
 */
export function FilterSheet() {
  const insets = useSafeAreaInsets();
  const visible = useCatalogStore((s) => s.sheetOpen);
  const filter = useCatalogStore((s) => s.filter);
  const setFilter = useCatalogStore((s) => s.setFilter);
  const closeSheet = useCatalogStore((s) => s.closeSheet);

  // Reads the filter via getState so the callback identity never changes and
  // memoized chips keep skipping re-renders
  const update = useCallback(
    (patch: Partial<BrowseFilter>) => setFilter({ ...useCatalogStore.getState().filter, ...patch }),
    [setFilter],
  );
  const selectGenre = useCallback((value: string | null) => update({ genre: value }), [update]);
  const selectType = useCallback((value: string | null) => update({ type: value }), [update]);
  const selectStatus = useCallback((value: string | null) => update({ status: value }), [update]);
  const selectYear = useCallback(
    (value: string | null) => update({ year: value === null ? null : Number(value) }),
    [update],
  );

  // Back closes the sheet instead of leaving the tab with the sheet still up
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeSheet();
      return true;
    });
    return () => sub.remove();
  }, [visible, closeSheet]);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/80 justify-end" style={{ elevation: 50 }}>
      <Pressable className="absolute inset-0" onPress={closeSheet} />

      <View className="bg-neutral-900 rounded-t-xl px-5 pt-5" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-bold">Filtros</Text>
          <Feather name="x" size={20} color={MUTED_ICON} onPress={closeSheet} style={{ padding: 4 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
          <Section title="Género">
            <Options options={GENRES} selected={filter.genre} onSelect={selectGenre} />
          </Section>

          <Section title="Año">
            {YEARS.map((year) => (
              <Chip
                key={year}
                label={String(year)}
                value={String(year)}
                active={filter.year === year}
                onSelect={selectYear}
              />
            ))}
          </Section>

          <Section title="Tipo">
            <Options options={BROWSE_TYPES} selected={filter.type} onSelect={selectType} />
          </Section>

          <Section title="Estado">
            <Options options={BROWSE_STATUSES} selected={filter.status} onSelect={selectStatus} />
          </Section>
        </ScrollView>
      </View>
    </View>
  );
}
