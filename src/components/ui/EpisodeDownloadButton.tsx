import { Alert, ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ACCENT_COLOR, MUTED_ICON } from "@/config/source";
import { downloadKey, useDownloadsStore, type DownloadStatus } from "@/stores/downloadsStore";

interface EpisodeDownloadButtonProps {
  slug: string;
  number: string;
  /** Opens the language sheet; the picker decides what gets downloaded. */
  onRequestDownload: () => void;
}

function labelFor(status: DownloadStatus | undefined, title: string): string {
  if (status === "queued" || status === "downloading") return `Cancelar descarga de ${title}`;
  if (status === "done") return `Eliminar descarga de ${title}`;
  if (status === "error") return `Reintentar descarga de ${title}`;
  return `Descargar ${title}`;
}

/**
 * One episode's download control. Subscribes to its own entry, so a segment
 * tick repaints this button and not the episode list around it.
 */
export function EpisodeDownloadButton({ slug, number, onRequestDownload }: EpisodeDownloadButtonProps) {
  const key = downloadKey(slug, number);
  const entry = useDownloadsStore((s) => s.entries[key]);
  const enqueue = useDownloadsStore((s) => s.enqueue);
  const cancel = useDownloadsStore((s) => s.cancel);
  const remove = useDownloadsStore((s) => s.remove);

  const status = entry?.status;
  const progress =
    entry != null && entry.status === "downloading" && entry.segmentsTotal > 0
      ? entry.segmentsDone / entry.segmentsTotal
      : 0;

  const handlePress = () => {
    if (status === "done") {
      Alert.alert(
        `Episodio ${number} descargado`,
        entry?.language != null ? `Guardado en ${entry.language}.` : "Guardado en el dispositivo.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Otro idioma", onPress: onRequestDownload },
          { text: "Eliminar", style: "destructive", onPress: () => void remove(key) },
        ],
      );
      return;
    }
    if (status === "queued" || status === "downloading") {
      cancel(key);
      return;
    }
    if (status === "error" && entry != null) {
      // Same language as the failed attempt, and a clean folder
      enqueue({ slug, number, title: entry.title, image: entry.image, language: entry.language });
      return;
    }
    onRequestDownload();
  };

  let glyph: React.ReactNode;
  if (status === "downloading") {
    glyph = (
      <View className="h-6 w-6 items-center justify-center">
        <ActivityIndicator size="small" color={ACCENT_COLOR} style={{ transform: [{ scale: 0.8 }] }} />
        <View className="absolute bottom-0 h-0.5 w-6 overflow-hidden rounded-full bg-neutral-700">
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: ACCENT_COLOR }}
          />
        </View>
      </View>
    );
  } else {
    const color = status === "error" ? "#f87171" : status === "done" ? ACCENT_COLOR : status === "queued" ? MUTED_ICON : "#FFFFFF";
    const name = status === "queued" ? "clock" : status === "done" ? "check-circle" : status === "error" ? "alert-circle" : "download";
    glyph = <Feather name={name} size={16} color={color} />;
  }

  return (
    <AnimatedPressable
      accessibilityLabel={labelFor(status, `episodio ${number}`)}
      hitSlop={10}
      hapticFeedback={true}
      onPress={handlePress}
      // Fixed box: the downloading state stacks a spinner and a bar on top
      className="h-6 w-6 items-center justify-center"
    >
      {glyph}
    </AnimatedPressable>
  );
}
