import React from "react";
import { Text } from "react-native";

interface SectionTitleProps {
  children: React.ReactNode;
}

/** titleSmall: 14sp, medium weight, on-surface-variant. No uppercase. */
export const SectionTitle = ({ children }: SectionTitleProps) => (
  <Text className="text-sm font-medium text-on-surface-variant">{children}</Text>
);
