import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { FloatingTabBar } from '@/components/app/FloatingTabBar';
import { Tabs } from 'expo-router';

// Biblioteca is the landing tab; the tabs group is the app's root screen
export const unstable_settings = { anchor: 'library' };

export default function TabLayout() {
  return (
    <ErrorBoundary>
      <Tabs
        backBehavior="initialRoute"
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Icons and labels live in FloatingTabBar: the tab bar is custom, so
            title and tabBarIcon here would never be drawn */}
        <Tabs.Screen name="library" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </ErrorBoundary>
  );
}
