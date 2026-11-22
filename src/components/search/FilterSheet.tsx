import { Feather } from "@expo/vector-icons";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect } from "react";
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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

/** Tapping the active value clears it, so one tap both picks and undoes */
function toggle(current: string | null, value: string): string | null {
  return current === value ? null : value;
}

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
  onToggle,
}: {
  options: BrowseOption[];
  selected: string | null;
  onToggle: (value: string | null) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          active={selected === option.value}
          onPress={() => onToggle(toggle(selected, option.value))}
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

  const update = (patch: Partial<BrowseFilter>) => setFilter({ ...filter, ...patch });

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
            <Options
              options={GENRES}
              selected={filter.genre}
              onToggle={(genre) => update({ genre })}
            />
          </Section>

          <Section title="Año">
            {YEARS.map((year) => {
              const value = String(year);
              return (
                <Chip
                  key={year}
                  label={value}
                  active={filter.year === year}
                  onPress={() => update({ year: filter.year === year ? null : year })}
                />
              );
            })}
          </Section>

          <Section title="Tipo">
            <Options
              options={BROWSE_TYPES}
              selected={filter.type}
              onToggle={(type) => update({ type })}
            />
          </Section>

          <Section title="Estado">
            <Options
              options={BROWSE_STATUSES}
              selected={filter.status}
              onToggle={(status) => update({ status })}
            />
          </Section>
        </ScrollView>
      </View>
    </View>
  );
}
