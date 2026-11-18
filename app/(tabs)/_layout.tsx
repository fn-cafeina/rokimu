import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

// Biblioteca is the landing tab; the tabs group is the app's root screen
export const unstable_settings = { initialRouteName: 'library' };

export default function TabLayout() {
  return (
    <ErrorBoundary>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="library"
          options={{
            title: "Biblioteca",
            tabBarIcon: ({ color }) => <Feather name="bookmark" size={24} color={typeof color === "string" ? color : undefined} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Explorar",
            tabBarIcon: ({ color }) => <Feather name="compass" size={24} color={typeof color === "string" ? color : undefined} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Ajustes",
            tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={typeof color === "string" ? color : undefined} />,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
