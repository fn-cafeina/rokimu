import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TabBarIcon } from "@/components/TabBarIcon";
import { ACCENT_COLOR } from "@/config/source";
import { useUpdateStore } from "@/stores/updateStore";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INACTIVE_TINT = "#a3a3a3";
const TAB_BAR_HEIGHT = 60;

function toIconColor(color: ColorValue): string {
  return typeof color === "string" ? color : INACTIVE_TINT;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const updateAvailable = useUpdateStore((s) => s.check.data?.updateAvailable ?? null);
  const updateCheckEnabled = useUpdateStore((s) => s.updateCheckEnabled);
  const showUpdateBadge = updateCheckEnabled && updateAvailable != null;

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACCENT_COLOR,
          tabBarInactiveTintColor: INACTIVE_TINT,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: "#171717",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: "#262626",
            height: TAB_BAR_HEIGHT + insets.bottom,
            elevation: 0,
          },
          tabBarIconStyle: { width: 56, height: 32 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="library"
          options={{
            title: "Biblioteca",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="bookmark" color={toIconColor(color)} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Buscar",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="search" color={toIconColor(color)} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Ajustes",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="settings" color={toIconColor(color)} focused={focused} badge={showUpdateBadge} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
