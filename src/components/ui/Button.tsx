import React from "react";
import { Text } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ACCENT_COLOR, MUTED_ICON, ON_ACCENT_COLOR } from "@/config/source";
import { Feather } from "@expo/vector-icons";

export type ButtonVariant = "filled" | "tonal" | "text";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  className?: string;
}

const CONTAINER: Record<ButtonVariant, string> = {
  filled: "bg-accent",
  tonal: "bg-primary-container",
  text: "",
};

const LABEL: Record<ButtonVariant, string> = {
  filled: "text-on-primary",
  tonal: "text-on-primary-container",
  text: "text-accent",
};

const ICON: Record<ButtonVariant, string> = {
  filled: ON_ACCENT_COLOR,
  tonal: "#C2E9FB",
  text: ACCENT_COLOR,
};

/** Material 3 common button: 40dp tall, full radius, label large. */
export const Button = ({
  label,
  onPress,
  variant = "filled",
  icon,
  disabled = false,
  className,
}: ButtonProps) => (
  <AnimatedPressable
    onPress={onPress}
    disabled={disabled}
    hapticFeedback
    accessibilityLabel={label}
    className={`h-10 flex-row items-center justify-center gap-2 rounded-full px-6 ${CONTAINER[variant]} ${className ?? ""}`}
    style={disabled ? { opacity: 0.38 } : undefined}
  >
    {icon != null && <Feather name={icon} size={18} color={ICON[variant]} />}
    <Text className={`text-sm font-medium ${LABEL[variant]}`}>{label}</Text>
  </AnimatedPressable>
);

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color?: string;
  label: string;
  size?: number;
}

/** Material 3 icon button: 48dp touch target around a 24dp icon. */
export const IconButton = ({ icon, onPress, color = MUTED_ICON, label, size = 22 }: IconButtonProps) => (
  <AnimatedPressable
    onPress={onPress}
    hapticFeedback
    accessibilityLabel={label}
    className="h-12 w-12 items-center justify-center rounded-full"
  >
    <Feather name={icon} size={size} color={color} />
  </AnimatedPressable>
);
