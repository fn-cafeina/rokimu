import { ACCENT_COLOR } from "@/config/source";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useUpdateStore, grantInstallPermissionAndDownload } from "@/stores/updateStore";
import { useEffect, useRef } from "react";
import { AppState, Text, View } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

const ACTION_LABEL = "text-sm font-medium text-on-surface px-6 py-4";
const ACTION_ACCENT = "text-sm font-medium text-accent px-6 py-4";

export function UpdateModal() {
  const phase = useUpdateStore((s) => s.phase);
  const updateAvailable = useUpdateStore((s) => s.check.data?.updateAvailable ?? null);
  const progress = useUpdateStore((s) => s.progress);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const closeUpdate = useUpdateStore((s) => s.closeUpdate);
  const confirmUpdate = useUpdateStore((s) => s.confirmUpdate);
  const beginDownload = useUpdateStore((s) => s.beginDownload);
  const cancelDownload = useUpdateStore((s) => s.cancelDownload);
  const resumeAfterPermission = useUpdateStore((s) => s.resumeAfterPermission);

  // After granting permission in system settings, resume automatically.
  // resumeAfterPermission is armed only when the settings screen is actually
  // opened, so an unrelated app switch while this modal is up never starts a
  // download without permission
  const resumeOnReturn = useRef(false);
  useEffect(() => {
    resumeOnReturn.current = resumeAfterPermission;
    if (!resumeAfterPermission) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !resumeOnReturn.current) return;
      resumeOnReturn.current = false;
      useUpdateStore.setState({ resumeAfterPermission: false });
      void beginDownload();
    });
    return () => sub.remove();
  }, [resumeAfterPermission, beginDownload]);

  if (phase === "idle" || phase === "ready") return null;

  // Download and install are not dismissable from the backdrop or the X
  const canDismiss = phase === "confirm" || phase === "permission" || phase === "error";

  const title =
    phase === "confirm" ? "Actualizar"
      : phase === "permission" ? "Permiso necesario"
        : phase === "downloading" ? "Descargando"
          : phase === "installing" ? "Preparando instalación"
            : "No se pudo actualizar";

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (phase === "confirm") {
    body = (
      <Text className="text-sm leading-5 text-on-surface-variant">
        {`Versión ${updateAvailable} disponible.`}
      </Text>
    );
    actions = (
      <View className="flex-row justify-end">
        <AnimatedPressable onPress={closeUpdate} className={ACTION_LABEL}>
          <Text className={ACTION_LABEL}>Cancelar</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={() => void confirmUpdate()} className={ACTION_ACCENT}>
          <Text className={ACTION_ACCENT}>Actualizar</Text>
        </AnimatedPressable>
      </View>
    );
  } else if (phase === "permission") {
    body = (
      <>
        <Text className="text-sm leading-5 text-on-surface-variant">
          Para instalar actualizaciones, permití que Rokimu instale aplicaciones en los ajustes del sistema.
        </Text>
        <Text className="mt-2 text-xs text-on-surface-variant/70">
          Al volver, la descarga continúa sola.
        </Text>
      </>
    );
    actions = (
      <View className="flex-row justify-end">
        <AnimatedPressable onPress={closeUpdate} className={ACTION_LABEL}>
          <Text className={ACTION_LABEL}>Cancelar</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={() => void grantInstallPermissionAndDownload()} className={ACTION_ACCENT}>
          <Text className={ACTION_ACCENT}>Abrir ajustes</Text>
        </AnimatedPressable>
      </View>
    );
  } else if (phase === "downloading") {
    const pct =
      progress.totalBytes != null && progress.totalBytes > 0
        ? Math.min(1, progress.receivedBytes / progress.totalBytes)
        : null;
    body = (
      <>
        <View className="mt-1 h-1 overflow-hidden rounded-full bg-surface-container-highest">
          <View
            className="h-full"
            style={{ width: `${(pct ?? 0.03) * 100}%`, backgroundColor: ACCENT_COLOR }}
          />
        </View>
        <Text className="mt-2 text-xs text-on-surface-variant">
          {pct != null
            ? `${Math.round(pct * 100)}% · ${formatSize(progress.receivedBytes)}`
            : `${formatSize(progress.receivedBytes)} descargados`}
        </Text>
      </>
    );
    actions = (
      <View className="flex-row justify-end">
        <AnimatedPressable onPress={cancelDownload} className={ACTION_LABEL}>
          <Text className={ACTION_LABEL}>Cancelar</Text>
        </AnimatedPressable>
      </View>
    );
  } else if (phase === "installing") {
    body = (
      <Text className="text-sm leading-5 text-on-surface-variant">Abriendo el instalador del sistema…</Text>
    );
  } else {
    body = (
      <Text className="text-sm leading-5 text-on-surface-variant" numberOfLines={4}>
        {errorMessage ?? "Ocurrió un error inesperado."}
      </Text>
    );
    actions = (
      <View className="flex-row justify-end">
        <AnimatedPressable onPress={closeUpdate} className={ACTION_LABEL}>
          <Text className={ACTION_LABEL}>Cerrar</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={() => void beginDownload()} className={ACTION_ACCENT}>
          <Text className={ACTION_ACCENT}>Reintentar</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <BottomSheet
      visible
      onClose={closeUpdate}
      title={title}
      dismissable={canDismiss}
      actions={actions}
    >
      {body}
    </BottomSheet>
  );
}
