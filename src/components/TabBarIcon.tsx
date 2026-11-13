import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  color: string;
  badge?: boolean;
}

/**
 * Just the glyph and its badge. The active pill is drawn by the navigation bar
 * (a 64x32 container behind the focused icon), so this stays a plain icon.
 */
export function TabBarIcon({ name, color, badge = false }: TabBarIconProps) {
  return (
    <View className="relative items-center justify-center">
      <Feather name={name} size={22} color={color} />
      {badge && <View className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-accent" />}
    </View>
  );
}
