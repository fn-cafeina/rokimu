import React from "react";
import { Text } from "react-native";

interface SectionTitleProps {
  children: React.ReactNode;
  /** Rendered on the same line, right aligned */
  trailing?: React.ReactNode;
}

/** titleSmall: 14sp, medium weight, on-surface-variant. No uppercase. */
export const SectionTitle = ({ children, trailing }: SectionTitleProps) => (
  <Text className="text-sm font-medium text-on-surface-variant">
    {children}
    {trailing}
  </Text>
);
