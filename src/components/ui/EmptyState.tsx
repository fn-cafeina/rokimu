import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { MUTED_ICON } from "@/config/source";

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
}

/** Centered empty / error state with one optional action. */
export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
}: EmptyStateProps) => (
  <View className="flex-1 items-center justify-center px-8 pt-16">
    <Feather name={icon} size={44} color={MUTED_ICON} />
    <Text className="mt-4 text-center text-base font-medium text-on-surface">{title}</Text>
    {description != null && (
      <Text className="mt-2 max-w-[300px] text-center text-sm text-on-surface-variant">
        {description}
      </Text>
    )}
    {actionLabel != null && onAction != null && (
      <Button
        label={actionLabel}
        icon={actionIcon}
        variant="tonal"
        onPress={onAction}
        className="mt-5"
      />
    )}
  </View>
);
