import React from "react";
import { Text, View } from "react-native";

interface TopAppBarProps {
  title: string;
}

/**
 * Small top app bar (Material 3): 48dp, centered-left title, no actions for now.
 * Screens own their safe-area padding; this bar sits below `insets.top`.
 */
export const TopAppBar = React.memo(function TopAppBar({ title }: TopAppBarProps) {
  return (
    <View className="h-12 justify-center px-5">
      <Text className="text-lg font-bold tracking-tight text-white">{title}</Text>
    </View>
  );
});
