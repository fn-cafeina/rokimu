import { ACCENT_COLOR, MUTED_ICON } from "@/config/theme";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  useDownloadsStore,
  MIN_DOWNLOAD_CONCURRENCY,
  MAX_DOWNLOAD_CONCURRENCY,
} from "@/stores/downloadsStore";
import { useUpdateStore, UPDATE_CHECK_RESOURCE_KEY } from "@/stores/updateStore";
import { isLoadingFor } from "@/utils/resource";
import { Feather } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Linking, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_OFFSET } from "@/utils/layout";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // The floating tab bar overlaps the bottom of the list. Reserve its height
  // only when the content needs it, and switch scrolling off when the whole
  // list already fits: a short screen must not drag over empty space.
  const clearance = TAB_BAR_OFFSET + insets.bottom;
  const fits = viewportHeight > 0 && contentHeight <= viewportHeight;

  const updateCheckEnabled = useUpdateStore((s) => s.updateCheckEnabled);  const setUpdateCheckEnabled = useUpdateStore((s) => s.setUpdateCheckEnabled);
  const updateAvailable = useUpdateStore((s) => s.check.data?.updateAvailable ?? null);
  const checkingForUpdates = useUpdateStore((s) => isLoadingFor(s.check, UPDATE_CHECK_RESOURCE_KEY));
  const lastCheckError = useUpdateStore((s) =>
    s.check.status === "error" && s.check.key === UPDATE_CHECK_RESOURCE_KEY
      ? s.check.error?.message ?? null
      : null,
  );
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const apkUrl = useUpdateStore((s) => s.check.data?.apkUrl ?? null);
  const startUpdate = useUpdateStore((s) => s.startUpdate);

  const concurrency = useDownloadsStore((s) => s.concurrency);
  const setConcurrency = useDownloadsStore((s) => s.setConcurrency);

  const preferredServer = useSettingsStore((s) => s.preferredServer);
  const setPreferredServer = useSettingsStore((s) => s.setPreferredServer);

  const appVersion = currentVersion ?? "—";

  const handleManualCheck = useCallback(() => {
    void checkForUpdates(true);
  }, [checkForUpdates]);

  const handleDownloadUpdate = useCallback(() => {
    if (apkUrl != null) {
      startUpdate();
      return;
    }
    // Fallback: release without an APK asset, open the download page
    void Linking.openURL("https://github.com/fn-cafeina/rokimu/releases");
  }, [apkUrl, startUpdate]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top + 16 }}>
      <ScrollView
        className="flex-1"
        scrollEnabled={!fits}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: fits ? 0 : clearance,
        }}
      >
      <View className="pb-6">
        <SectionTitle>Actualizaciones</SectionTitle>
        <View className="mb-3" />
        <View className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            <View className="flex-row items-center px-5 py-4">
              <Feather name="bell" size={18} color={MUTED_ICON} style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Text className="text-base font-medium text-white">
                  Buscar actualizaciones
                </Text>
                <Text className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">
                  Al iniciar la app
                </Text>
              </View>
              <Switch
                value={updateCheckEnabled}
                onValueChange={(v) => { void setUpdateCheckEnabled(v); }}
                trackColor={{ false: "#404040", true: ACCENT_COLOR }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View className="h-px bg-neutral-800" />
            <AnimatedPressable
              onPress={updateAvailable ? handleDownloadUpdate : handleManualCheck}
              disabled={checkingForUpdates}
              hapticFeedback={!checkingForUpdates}
              className="flex-row items-center px-5 py-4"
              style={{ opacity: checkingForUpdates ? 0.5 : 1 }}
            >
              <Feather name="download" size={18} color={ACCENT_COLOR} style={{ marginRight: 12 }} />
              <View className="flex-1 min-w-0">
                <Text className="text-base font-medium text-white">
                  Buscar actualización
                </Text>
                <View className="h-[18px] justify-center mt-0.5">
                  {checkingForUpdates && (
                    <Text className="text-xs font-semibold tracking-wide text-neutral-500">
                      Buscando...
                    </Text>
                  )}
                  {!checkingForUpdates && lastCheckError && (
                    <Text className="text-xs font-semibold tracking-wide text-red-400/70">
                      {lastCheckError}
                    </Text>
                  )}
                  {!checkingForUpdates && !lastCheckError && updateAvailable && (
                    <Text className="text-xs font-semibold tracking-wide text-accent">
                      v{updateAvailable} disponible
                    </Text>
                  )}
                  {!checkingForUpdates && !lastCheckError && !updateAvailable && appVersion && (
                    <Text className="text-xs font-semibold tracking-wide text-emerald-400">
                      Estás al día
                    </Text>
                  )}
                </View>
              </View>
              {!checkingForUpdates && !lastCheckError && updateAvailable && (
                <AnimatedPressable
                  onPress={handleDownloadUpdate}
                  className="flex-row items-center gap-1 ml-auto flex-shrink-0"
                >
                  <Text className="text-xs font-semibold tracking-wide text-accent">
                    Actualizar
                  </Text>
                  <Feather name="arrow-right" size={11} color={ACCENT_COLOR} />
                </AnimatedPressable>
              )}
            </AnimatedPressable>
          </View>

        <View className="mt-8">
          <SectionTitle>Descargas</SectionTitle>
          <View className="mb-3" />
          <View className="flex-row items-center px-5 py-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <Feather name="layers" size={18} color={MUTED_ICON} style={{ marginRight: 12 }} />
            <View className="flex-1">
              <Text className="text-base font-medium text-white">Simultáneas</Text>
              <Text className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">
                Episodios a la vez
              </Text>
            </View>
            <View className="flex-row items-center">
              <AnimatedPressable
                accessibilityLabel="Disminuir descargas simultáneas"
                accessibilityState={{ disabled: concurrency <= MIN_DOWNLOAD_CONCURRENCY }}
                disabled={concurrency <= MIN_DOWNLOAD_CONCURRENCY}
                hitSlop={6}
                hapticFeedback={true}
                debounceMs={0}
                onPress={() => void setConcurrency(concurrency - 1)}
                className="min-h-8 min-w-8 items-center justify-center"
              >
                <Feather
                  name="minus"
                  size={18}
                  color={concurrency <= MIN_DOWNLOAD_CONCURRENCY ? "#404040" : MUTED_ICON}
                />
              </AnimatedPressable>
              <Text className="w-8 text-center text-base font-semibold text-white">{concurrency}</Text>
              <AnimatedPressable
                accessibilityLabel="Aumentar descargas simultáneas"
                accessibilityState={{ disabled: concurrency >= MAX_DOWNLOAD_CONCURRENCY }}
                disabled={concurrency >= MAX_DOWNLOAD_CONCURRENCY}
                hitSlop={6}
                hapticFeedback={true}
                debounceMs={0}
                onPress={() => void setConcurrency(concurrency + 1)}
                className="min-h-8 min-w-8 items-center justify-center"
              >
                <Feather
                  name="plus"
                  size={18}
                  color={concurrency >= MAX_DOWNLOAD_CONCURRENCY ? "#404040" : MUTED_ICON}
                />
              </AnimatedPressable>
            </View>
          </View>
        </View>

        <View className="mt-8">
          <SectionTitle>Reproducción</SectionTitle>
          <View className="mb-3" />
          <View className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
            <View className="flex-row items-center">
              <Feather name="play" size={18} color={MUTED_ICON} style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Text className="text-base font-medium text-white">Servidor preferido</Text>
                <Text className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">
                  Coral suele ir más rápido
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row rounded-lg border border-neutral-800 bg-black p-1">
              {(
                [
                  { label: "Auto", value: null },
                  { label: "Coral", value: "Delta" },
                  { label: "Jade", value: "Epsilon" },
                ] as const
              ).map((option) => {
                const active = preferredServer === option.value;
                return (
                  <AnimatedPressable
                    key={option.label}
                    accessibilityLabel={`Servidor preferido ${option.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => void setPreferredServer(option.value)}
                    hapticFeedback={true}
                    className={`flex-1 items-center justify-center py-2 rounded-md ${
                      active ? "bg-accent/20" : "bg-transparent"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? "text-accent" : "text-neutral-400"}`}
                    >
                      {option.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        </View>

        <View className="mt-8">
          <SectionTitle>Acerca de</SectionTitle>
          <View className="mb-3" />
          <View className="flex-row items-center px-5 py-4 rounded-xl border border-neutral-800 bg-neutral-900">
            <Feather name="info" size={18} color={MUTED_ICON} style={{ marginRight: 12 }} />
            <View className="flex-1">
              <Text className="text-base font-medium text-white">Versión {appVersion}</Text>
              <Text className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">Rokimu</Text>
            </View>
          </View>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}
