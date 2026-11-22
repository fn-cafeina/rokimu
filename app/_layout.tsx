import "../global.css";
import { UpdateModal } from "@/components/app/UpdateModal";
import { FilterSheet } from "@/components/search/FilterSheet";
import { WebViewWorker } from "@/components/app/WebViewWorker";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { bootApp } from "@/services/boot";
import { isPlayerActive, resetToPortrait } from "@/services/playerUI";
import { useUpdateStore } from "@/stores/updateStore";
import { logger } from "@/utils/logger";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const RECONNECT_UPDATE_DELAY = 2000;

function RootInner() {
  const [ready, setReady] = useState(false);
  const { isInternetReachable } = useNetworkStatus();
  const prevReachable = useRef<boolean | null>(null);

  useEffect(() => {
    const prev = prevReachable.current;
    prevReachable.current = isInternetReachable;
    if (prev === false && isInternetReachable === true) {
      const timer = setTimeout(() => {
        const updateState = useUpdateStore.getState();
        if (updateState.updateCheckEnabled !== false) {
          void updateState.checkForUpdates();
        }
      }, RECONNECT_UPDATE_DELAY);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isInternetReachable]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // Android may re-apply the orientation saved in the ActivityRecord during
      // an activity recreation, after the one-shot boot reset already ran.
      // Re-assert portrait on every foreground return unless playback owns it
      if (!isPlayerActive()) void resetToPortrait();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    bootApp()
      .catch((error) => logger.error("lifecycle", "Initialization failed", error))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <View className="flex-1 bg-black" />;
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "#000000" },
          statusBarStyle: "light",
        }}
      >
        {/* animation none: app/index.tsx redirects / to the tabs group, and the
            default slide_from_right made that boot redirect look like a sideways
            entry animation */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, orientation: "portrait", animation: "none" }} />
        <Stack.Screen name="anime/[slug]" options={{ headerShown: false, orientation: "portrait" }} />
        {/* player owns the screen orientation via setupImmersiveMode; declaring
            landscape here keeps RNScreens from re-applying UNSPECIFIED over the
            JS lock on every focus */}
        <Stack.Screen name="player" options={{ headerShown: false, animation: "fade_from_bottom", statusBarHidden: true, orientation: "landscape" }} />
      </Stack>
      <WebViewWorker />
      <UpdateModal />
      <FilterSheet />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootInner />
    </SafeAreaProvider>
  );
}
