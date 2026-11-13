import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TabBarIcon } from "@/components/TabBarIcon";
import {
  ACCENT_COLOR,
  ON_SURFACE,
  ON_SURFACE_VARIANT,
  SURFACE_CONTAINER,
} from "@/config/source";
import { useUpdateStore } from "@/stores/updateStore";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Material 3 navigation bar: 80dp of content above the system inset
const NAV_BAR_HEIGHT = 80;
const BADGE_ROUTES = new Set(["settings"]);

/**
 * Bottom navigation bar written by hand.
 *
 * expo-router's "material" tab bar variant is a navigation rail: it throws
 * unless tabBarPosition is left or right, and it paints the item pill with a
 * square 16dp radius. Owning the bar keeps the 80dp height, the 64x32 active
 * pill and the label colours under our control.
 */
function MaterialTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const updateAvailable = useUpdateStore((s) => s.check.data?.updateAvailable ?? null);
  const updateCheckEnabled = useUpdateStore((s) => s.updateCheckEnabled);
  const showUpdateBadge = updateCheckEnabled && updateAvailable != null;

  return (
    <View
      style={{ backgroundColor: SURFACE_CONTAINER, paddingBottom: insets.bottom }}
      className="flex-row items-stretch"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);

        return (
          <AnimatedPressable
            key={route.key}
            hapticFeedback
            debounceMs={0}
            onPress={() => navigateToTab(route.key)}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            style={styles.item}
          >
            <Animated.View entering={FadeIn.duration(150)} style={styles.content}>
              <View
                className={`h-8 w-16 items-center justify-center rounded-2xl ${
                  focused ? "bg-accent/15" : ""
                }`}
              >
                <TabBarIcon
                  name={
                    route.name === "library"
                      ? "bookmark"
                      : route.name === "search"
                        ? "compass"
                        : "settings"
                  }
                  color={focused ? ACCENT_COLOR : ON_SURFACE_VARIANT}
                  badge={BADGE_ROUTES.has(route.name) && showUpdateBadge}
                />
              </View>
              <Text
                numberOfLines={1}
                className={`mt-1 text-xs ${focused ? "font-semibold" : "font-medium"}`}
                style={{ color: focused ? ON_SURFACE : ON_SURFACE_VARIANT }}
              >
                {label}
              </Text>
            </Animated.View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <MaterialTabBar {...props} />}
      >
        <Tabs.Screen name="library" options={{ title: "Biblioteca" }} />
        <Tabs.Screen name="search" options={{ title: "Explorar" }} />
        <Tabs.Screen name="settings" options={{ title: "Ajustes" }} />
      </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, height: NAV_BAR_HEIGHT },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 12 },
});
