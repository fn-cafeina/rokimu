import { ACCENT_COLOR } from "@/config/source";
import { CACHE_PREFIXES } from "@/config/cache";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { ListDivider, ListGroup, ListItem } from "@/components/ui/ListItem";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUpdateStore, UPDATE_CHECK_RESOURCE_KEY } from "@/stores/updateStore";
import { refreshSession } from "@/services/session";
import { isLoadingFor } from "@/utils/resource";
import { storage } from "@/utils/storage";
import { SCREEN_BOTTOM_PADDING } from "@/utils/layout";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, useCallback } from "react";
import { Alert, Linking, ScrollView, Switch, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export default function SettingsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [refreshed, setRefreshed] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCheckEnabled = useUpdateStore((s) => s.updateCheckEnabled);
  const setUpdateCheckEnabled = useUpdateStore((s) => s.setUpdateCheckEnabled);
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

  const refreshSupporting = refreshing
    ? "Renovando sesión y caché..."
    : refreshFailed
      ? "No se pudo renovar. Reintentá."
      : refreshed
        ? "Conexión renovada"
        : "Refresca sesión y caché";

  const updateSupporting = checkingForUpdates
    ? "Buscando..."
    : lastCheckError ?? (updateAvailable != null ? `v${updateAvailable} disponible` : "Estás al día");

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_PADDING + 8 }}
      showsVerticalScrollIndicator={false}
    >
      <TopAppBar title="Ajustes" />

      <View className="gap-6 px-4 pt-4">
        <View className="gap-3">
          <SectionTitle>Conexión</SectionTitle>
          <ListGroup>
            <ListItem
              headline={refreshing ? "Renovando conexión..." : "Renovar conexión"}
              supporting={refreshSupporting}
              onPress={handleRefresh}
              disabled={refreshing}
              trailing={
                <Animated.View style={spinStyle}>
                  <Feather name="refresh-cw" size={20} color={ACCENT_COLOR} />
                </Animated.View>
              }
            />
          </ListGroup>
        </View>

        <View className="gap-3">
          <SectionTitle>Actualizaciones</SectionTitle>
          <ListGroup>
            <ListItem
              headline="Buscar actualizaciones"
              supporting="Al iniciar la app"
              leadingIcon="bell"
              trailing={
                <Switch
                  value={updateCheckEnabled}
                  onValueChange={(v) => { void setUpdateCheckEnabled(v); }}
                  trackColor={{ false: "#49454F", true: ACCENT_COLOR }}
                  thumbColor="#E6E0E9"
                />
              }
            />
            <ListDivider />
            <ListItem
              headline={updateAvailable != null ? "Actualización disponible" : "Buscar actualización"}
              supporting={updateSupporting}
              leadingIcon="download"
              disabled={checkingForUpdates}
              onPress={updateAvailable != null ? handleDownloadUpdate : handleManualCheck}
              trailing={
                updateAvailable != null && !checkingForUpdates ? (
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs font-medium text-accent">Actualizar</Text>
                    <Feather name="arrow-right" size={14} color={ACCENT_COLOR} />
                  </View>
                ) : undefined
              }
            />
          </ListGroup>
        </View>

        <View className="gap-3">
          <SectionTitle>Acerca de</SectionTitle>
          <ListGroup>
            <ListItem
              headline={`Versión ${appVersion}`}
              supporting="Rokimu"
              leadingIcon="info"
            />
          </ListGroup>
        </View>
      </View>
    </ScrollView>
  );
}
