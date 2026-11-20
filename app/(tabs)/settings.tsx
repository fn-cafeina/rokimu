import { ACCENT_COLOR, MUTED_ICON } from "@/config/theme";
import { CACHE_PREFIXES } from "@/config/cache";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  useDownloadsStore,
  MIN_DOWNLOAD_CONCURRENCY,
  MAX_DOWNLOAD_CONCURRENCY,
} from "@/stores/downloadsStore";
import { useUpdateStore, UPDATE_CHECK_RESOURCE_KEY } from "@/stores/updateStore";
import { refreshSession } from "@/services/session";
import { isLoadingFor } from "@/utils/resource";
import { storage } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, useCallback } from "react";
import { Alert, Linking, ScrollView, Switch, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_OFFSET } from "@/utils/layout";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [refreshed, setRefreshed] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const spin = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      spin.value = withRepeat(withTiming(360, { duration: 1200, easing: Easing.linear }), -1);
    } else {
      spin.value = withTiming(0, { duration: 0 });
    }
  }, [refreshing, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  useEffect(() => () => {
    const t = refreshedTimer.current;
    if (t != null) clearTimeout(t);
    const ft = failedTimer.current;
    if (ft != null) clearTimeout(ft);
  }, []);

  const runRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshFailed(false);
    setRefreshed(false);
    try {
      await refreshSession();
      // Only session-sensitive caches; anime/servers/stream data stays valid
      const allKeys = await storage.getAllKeys();
      const cacheKeys = allKeys.filter(
        (k) => k.startsWith(CACHE_PREFIXES.HOME) || k.startsWith(CACHE_PREFIXES.SEARCH),
      );
      await Promise.all(cacheKeys.map((k) => storage.remove(k)));
      // invalidateCache makes the home screen refetch after the cache wipe
      useSettingsStore.getState().invalidateCache();
      setRefreshed(true);
      if (refreshedTimer.current != null) clearTimeout(refreshedTimer.current);
      refreshedTimer.current = setTimeout(() => setRefreshed(false), 2000);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setRefreshFailed(true);
      if (failedTimer.current != null) clearTimeout(failedTimer.current);
      failedTimer.current = setTimeout(() => setRefreshFailed(false), 3000);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshingRef.current) {
      Alert.alert("Renovación en curso", "Ya hay una renovación de conexión en curso. Esperá a que termine.");
      return;
    }
    Alert.alert(
      "Renovar conexión",
      "Si el contenido no carga o ves errores, esto renueva la conexión con el servidor para intentar solucionarlo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Renovar",
          style: "default",
          onPress: () => {
            // Re-check: a refresh may have started while the Alert was open
            if (refreshingRef.current) return;
            void runRefresh();
          },
        },
      ],
    );
  }, [runRefresh]);

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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_OFFSET + insets.bottom }}
      >
      <View className="pb-6">
        <SectionTitle>Conexión</SectionTitle>
        <View className="mb-3" />
        <AnimatedPressable
          onPress={handleRefresh}
          disabled={refreshing}
          hapticFeedback={true}
          className="flex-row items-center w-full px-5 py-4 rounded-xl border border-neutral-800 bg-neutral-900"
          style={{ opacity: refreshing ? 0.5 : 1 }}
        >
          <Animated.View style={[spinStyle, { marginRight: 12 }]}>
            <Feather name="refresh-cw" size={18} color={ACCENT_COLOR} />
          </Animated.View>
          <View className="flex-1">
            <Text className="text-base font-medium text-white">
              {refreshing
                ? "Renovando conexión..."
                : refreshFailed
                  ? "Error al renovar"
                  : refreshed
                    ? "Conexión renovada"
                    : "Renovar conexión"}
            </Text>
            <Text className="mt-1 text-xs font-semibold tracking-wide text-neutral-400">
              {refreshing ? "Renovando sesión y caché..." : "Refresca sesión y caché"}
            </Text>
          </View>
        </AnimatedPressable>

        <View className="mt-8">
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
                  Se prueba primero al reproducir o descargar
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row rounded-lg border border-neutral-800 bg-black p-1">
              {(
                [
                  { label: "Auto", value: null },
                  { label: "Delta", value: "Delta" },
                  { label: "Epsilon", value: "Epsilon" },
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
