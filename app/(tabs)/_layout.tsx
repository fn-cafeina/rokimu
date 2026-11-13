import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TabBarIcon } from "@/components/TabBarIcon";
import { ACCENT_COLOR, ON_SURFACE_VARIANT, SURFACE_CONTAINER } from "@/config/source";
import { useUpdateStore } from "@/stores/updateStore";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Material 3 navigation bar: 80dp of content above the system inset
const TAB_BAR_HEIGHT = 80;

function toIconColor(color: ColorValue): string {
  return typeof color === "string" ? color : ON_SURFACE_VARIANT;
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
          tabBarVariant: "material",
          tabBarActiveTintColor: ACCENT_COLOR,
          tabBarInactiveTintColor: ON_SURFACE_VARIANT,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: SURFACE_CONTAINER,
            borderTopWidth: 0,
            elevation: 0,
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
        }}
      >
        <Tabs.Screen
          name="library"
          options={{
            title: "Biblioteca",
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="bookmark" color={toIconColor(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Explorar",
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="compass" color={toIconColor(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Ajustes",
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="settings" color={toIconColor(color)} badge={showUpdateBadge} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
