import React from "react";
import { Text, View } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { MUTED_ICON } from "@/config/source";
import { Feather } from "@expo/vector-icons";

interface ListItemProps {
  headline: string;
  supporting?: string;
  leadingIcon?: keyof typeof Feather.glyphMap;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * Material 3 list item. Inside a ListGroup the group paints the container, so
 * the item only owns padding and dividers.
 */
export const ListItem = ({
  headline,
  supporting,
  leadingIcon,
  trailing,
  onPress,
  disabled = false,
}: ListItemProps) => {
  const content = (
    <>
      {leadingIcon != null && (
        <Feather name={leadingIcon} size={20} color={MUTED_ICON} />
      )}
      <View className="flex-1">
        <Text className="text-base font-normal text-on-surface">{headline}</Text>
        {supporting != null && (
          <Text className="mt-0.5 text-xs text-on-surface-variant">{supporting}</Text>
        )}
      </View>
      {trailing}
    </>
  );

  if (onPress == null) {
    return (
      <View
        className="flex-row items-center gap-4 px-4"
        style={{ minHeight: 72, opacity: disabled ? 0.38 : 1 }}
      >
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      hapticFeedback
      accessibilityLabel={headline}
      className="flex-row items-center gap-4 px-4"
      style={{ minHeight: 72, opacity: disabled ? 0.38 : 1 }}
    >
      {content}
    </AnimatedPressable>
  );
};

interface ListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/** Material 3 filled container that groups list items or settings rows. */
export const ListGroup = ({ children, className }: ListGroupProps) => (
  <View className={`overflow-hidden rounded-3xl bg-surface-container ${className ?? ""}`}>
    {children}
  </View>
);

/** Hairline divider matching the Material 3 outline variant role. */
export const ListDivider = () => <View className="h-px bg-outline-variant" />;
