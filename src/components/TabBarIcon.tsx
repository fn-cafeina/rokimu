import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  color: string;
  badge?: boolean;
}

/**
 * The active pill is drawn by the tab bar itself (tabBarVariant "material"
 * paints a 0.12 alpha container behind the focused item), so this renders the
 * glyph only. An earlier version added its own accent pill on top of it and
 * every focused tab showed two indicators.
 */
export function TabBarIcon({ name, color, badge = false }: TabBarIconProps) {
  return (
    <View className="relative items-center justify-center">
      <Feather name={name} size={24} color={color} />
      {badge && <View className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-accent" />}
    </View>
  );
}
