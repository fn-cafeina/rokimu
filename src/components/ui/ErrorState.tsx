import { MUTED_ICON } from "@/config/source";
import type { AppError } from "@/types";
import { Feather } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  onRetry: () => void;
  /** The real settled error; the subtitle explains its actual cause */
  error?: AppError | null;
  title?: string;
}

const SUBTITLES: Record<AppError["type"], string> = {
  NETWORK_ERROR: "No se pudo conectar con el sitio. Revisa tu conexión e inténtalo de nuevo.",
  AUTH_ERROR: "El sitio está verificando la conexión. Reintenta en unos segundos.",
  TIMEOUT: "El sitio tardó demasiado en responder. Inténtalo de nuevo en un momento.",
  VIDEO_ERROR: "El servidor de video no respondió. Inténtalo de nuevo en unos minutos.",
  PARSER_ERROR: "El sitio devolvió un contenido inesperado. Puede ser un cambio del sitio o un fallo temporal.",
  UNKNOWN: "El sitio está tardando más de lo normal en responder. Inténtalo de nuevo en un momento.",
};

export function ErrorState({ onRetry, error, title = "Error al cargar" }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-8">
      <Feather name="alert-circle" size={44} color={MUTED_ICON} />
      <Text className="mt-4 text-center text-base font-medium text-on-surface">{title}</Text>
      <Text className="mt-2 max-w-[300px] text-center text-sm text-on-surface-variant">
        {SUBTITLES[error?.type ?? "UNKNOWN"]}
      </Text>
      <Button label="Reintentar" icon="refresh-cw" variant="tonal" onPress={onRetry} className="mt-5" />
    </View>
  );
}
