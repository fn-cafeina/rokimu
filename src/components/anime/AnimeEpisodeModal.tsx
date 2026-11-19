import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppError, EpisodeSheetRow } from "@/types";
import Animated, { FadeIn } from "react-native-reanimated";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { Skeleton } from "@/components/ui/Skeleton";
import { ACCENT_COLOR } from "@/config/theme";

interface AnimeEpisodeModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  rows: EpisodeSheetRow[];
  isLoading: boolean;
  /** Real fetch failure for this episode; never conflated with "no servers" */
  error?: AppError | null;
  /** No network: the sheet could not even ask for servers */
  isOffline?: boolean;
  onRetry?: () => void;
}

const ACTION_LABEL: Record<EpisodeSheetRow["icon"], (language: string) => string> = {
  download: (language) => `Descargar en ${language}`,
  trash: (language) => `Eliminar descarga en ${language}`,
  stop: (language) => `Detener descarga en ${language}`,
};

const ACTION_ICON: Record<EpisodeSheetRow["icon"], React.ComponentProps<typeof Feather>["name"]> = {
  download: "download",
  trash: "trash-2",
  stop: "square",
};

export const AnimeEpisodeModal = ({
  visible, onClose, title, rows, isLoading, error, isOffline, onRetry
}: AnimeEpisodeModalProps) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/80 justify-end">
      <Pressable className="absolute inset-0" onPress={onClose} />

      <View
        className="bg-neutral-900 rounded-t-xl px-5 pt-5"
        style={{ paddingBottom: insets.bottom + 16 }}
      >

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-white text-xl font-bold">{title}</Text>
          <Feather name="x" size={20} color="#a3a3a3" onPress={onClose} />
        </View>

        <Text className="text-neutral-400 text-xs mb-2">
          Selecciona un idioma
        </Text>

        <View className="gap-2">
          {rows.map((row, index) => (
            <Animated.View key={row.key} entering={FadeIn.delay(index * 50).duration(200)}>
              <AnimatedPressable
                accessibilityLabel={`Reproducir en ${row.language}`}
                className="flex-row items-center bg-black p-4 rounded-xl"
                onPress={row.onSelect}
              >
                <Text className="text-white font-bold flex-1">{row.language}</Text>
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {row.hint}
                </Text>
                <AnimatedPressable
                  accessibilityLabel={ACTION_LABEL[row.icon](row.language)}
                  className="ml-3 h-8 w-8 items-center justify-center rounded-full bg-white/5"
                  hitSlop={8}
                  onPress={row.onAction}
                >
                  <Feather name={ACTION_ICON[row.icon]} size={14} color="#a3a3a3" />
                </AnimatedPressable>
              </AnimatedPressable>
            </Animated.View>
          ))}
          {isLoading && rows.length === 0 ? (
            <View className="gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <View key={`skel-${i}`} className="flex-row items-center bg-black p-4 rounded-xl">
                  <Skeleton width={120} height={16} borderRadius={4} />
                </View>
              ))}
            </View>
          ) : error != null ? (
            <View className="h-48 justify-center items-center gap-3">
              <Feather name="alert-circle" size={32} color="#404040" />
              <Text className="text-neutral-400 text-xs text-center px-6">
                No se pudieron cargar los servidores
              </Text>
              {onRetry != null && (
                <AnimatedPressable
                  className="flex-row items-center px-5 py-2.5 rounded-xl bg-accent/15"
                  onPress={onRetry}
                >
                  <Feather name="refresh-cw" size={14} color={ACCENT_COLOR} />
                  <Text className="ml-2 text-xs font-semibold tracking-wide text-accent">Reintentar</Text>
                </AnimatedPressable>
              )}
            </View>
          ) : rows.length === 0 ? (
            <View className="h-48 justify-center items-center px-6">
              <Text className="text-neutral-400 text-xs text-center">
                {isOffline
                  ? "Sin conexión. Conectate para ver los servidores."
                  : "No hay servidor disponible"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

AnimeEpisodeModal.displayName = "AnimeEpisodeModal";
