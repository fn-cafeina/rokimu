import { MUTED_ICON } from "@/config/theme";
import { Feather } from "@expo/vector-icons";
import { Text, View } from "react-native";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
}

export function EmptyState({ title, subtitle, icon = "frown" }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-5">
      <Feather name={icon} size={48} color={MUTED_ICON} />
      <Text className="mt-4 text-center text-sm font-semibold text-neutral-500">
        {title}
      </Text>
      {subtitle != null && (
        <Text className="mt-2 max-w-[300px] text-center text-xs text-neutral-600">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
