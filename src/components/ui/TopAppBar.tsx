import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TopAppBarProps {
  title: string;
  /** Rendered before the title, usually an IconButton */
  leading?: React.ReactNode;
  /** Rendered after the title, right aligned */
  actions?: React.ReactNode;
  /** Paints the status bar inset above the bar. Off for screens that draw behind it. */
  insetTop?: boolean;
}

/**
 * Small top app bar (Material 3): 64dp tall, titleLarge, leading 48dp icon
 * slot. The bar owns the status bar inset so screens stop repeating it.
 */
export const TopAppBar = React.memo(function TopAppBar({
  title,
  leading,
  actions,
  insetTop = true,
}: TopAppBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-surface" style={{ paddingTop: insetTop ? insets.top : 0 }}>
      <View className="h-16 flex-row items-center gap-1 px-4">
        {leading}
        <Text
          className="flex-1 text-[22px] font-normal leading-7 text-on-surface"
          numberOfLines={1}
        >
          {title}
        </Text>
        {actions}
      </View>
    </View>
  );
});
