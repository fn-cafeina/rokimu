import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  color: string;
  focused: boolean;
  badge?: boolean;
}

export function TabBarIcon({ name, color, focused, badge = false }: TabBarIconProps) {
  return (
    <View
      className={`items-center justify-center rounded-full px-3 py-1 ${focused ? "bg-accent/15" : ""}`}
    >
      <View className="relative">
        <Feather name={name} size={20} color={color} />
        {badge && (
          <View className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent" />
        )}
      </View>
    </View>
  );
}
