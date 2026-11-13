import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Tapping the scrim and the X can both be disabled for blocking steps */
  dismissable?: boolean;
  /** Actions pinned under the content, separated by a divider */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Material 3 bottom sheet: 28dp top corners, drag handle, scrim. Screens keep
 * their own visibility state, this only owns chrome.
 */
export const BottomSheet = ({
  visible,
  onClose,
  title,
  dismissable = true,
  actions,
  children,
}: BottomSheetProps) => {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      className="absolute inset-0 justify-end bg-black/60"
    >
      <Pressable
        className="absolute inset-0"
        onPress={dismissable ? onClose : undefined}
        disabled={!dismissable}
        accessibilityLabel="Cerrar"
      />

      <View
        className="rounded-t-[28px] bg-surface-container-high px-6 pt-3"
        style={{ paddingBottom: actions == null ? insets.bottom + 24 : 0 }}
      >
        <View className="mb-4 h-1 w-8 self-center rounded-full bg-outline-variant" />

        {title != null && (
          <Text className="mb-3 text-2xl font-normal text-on-surface">{title}</Text>
        )}

        {children}

        {actions != null && (
          <View className="-mx-6 mt-6" style={{ paddingBottom: insets.bottom }}>
            <View className="h-px bg-outline-variant" />
            {actions}
          </View>
        )}
      </View>
    </Animated.View>
  );
};
