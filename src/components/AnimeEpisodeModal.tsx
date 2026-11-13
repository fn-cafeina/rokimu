import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import type { AppError, Episode, VideoServer } from "@/types";
import Animated, { FadeIn } from "react-native-reanimated";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/source";

interface AnimeEpisodeModalProps {
  visible: boolean;
  onClose: () => void;
  episode: Episode | null;
  servers: VideoServer[];
  isLoading: boolean;
  /** Real fetch failure for this episode; never conflated with "no servers" */
  error?: AppError | null;
  onRetry?: () => void;
  onServerSelect: (server: VideoServer) => void;
}

export const AnimeEpisodeModal = ({
  visible, onClose, episode, servers, isLoading, error, onRetry, onServerSelect
}: AnimeEpisodeModalProps) => {
  const delta = servers.filter((s) => s.title.toLowerCase().includes("delta"));
  const displayServers = delta.length > 0 ? delta : servers;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Episodio ${episode?.number ?? ""}`}>
      <Text className="mb-3 text-sm text-on-surface-variant">Selecciona un idioma</Text>

      {isLoading ? (
        <View className="gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={`skel-${i}`} width="100%" height={56} borderRadius={16} />
          ))}
        </View>
      ) : error != null ? (
        <EmptyState
          icon="alert-circle"
          title="No se pudieron cargar los servidores"
          description="Revisa tu conexión e inténtalo de nuevo."
          actionLabel={onRetry != null ? "Reintentar" : undefined}
          actionIcon="refresh-cw"
          onAction={onRetry}
        />
      ) : displayServers.length === 0 ? (
        <EmptyState icon="slash" title="No hay servidor disponible" />
      ) : (
        <View className="gap-2">
          {displayServers.map((server, index) => (
            <Animated.View key={server.id || `server-${index}`} entering={FadeIn.delay(index * 50).duration(200)}>
              <AnimatedPressable
                className="flex-row items-center gap-4 rounded-2xl bg-surface-container-highest px-4 py-4"
                onPress={() => { onServerSelect(server); }}
                hapticFeedback
                accessibilityLabel={`Ver en ${server.language ?? "servidor desconocido"}`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-container">
                  <Feather name="play" size={18} color={ACCENT_COLOR} />
                </View>
                <Text className="flex-1 text-base font-medium text-on-surface">
                  {server.language ?? "Desconocido"}
                </Text>
                <Feather name="chevron-right" size={20} color={MUTED_ICON} />
              </AnimatedPressable>
            </Animated.View>
          ))}
        </View>
      )}

      <Button label="Cancelar" variant="text" onPress={onClose} className="mt-4 self-center" />
    </BottomSheet>
  );
};

AnimeEpisodeModal.displayName = "AnimeEpisodeModal";
