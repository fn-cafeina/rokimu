import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  color: string;
  focused: boolean;
  badge?: boolean;
}

/**
 * Material 3 active indicator: a 64x32 pill behind the icon of the focused
 * destination. The navigator does not paint one on bottom bars (its
 * "material" variant throws unless the bar is a sidebar), so the pill lives
 * here.
 */
export function TabBarIcon({ name, color, focused, badge = false }: TabBarIconProps) {
  return (
    <View className="relative items-center justify-center">
      <View
        className={`h-8 w-16 items-center justify-center rounded-2xl ${focused ? "bg-accent/15" : ""}`}
      >
        <Feather name={name} size={22} color={color} />
      </View>
      {badge && <View className="absolute right-3 top-0 h-2 w-2 rounded-full bg-accent" />}
    </View>
  );
}
