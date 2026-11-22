import React from "react";
import { View } from "react-native";
import { calcProgress } from "@/hooks/episodeProgress";
import { ACCENT_COLOR } from "@/config/theme";

interface ProgressBarProps {
  progress?: number;
  duration?: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ progress, duration, color, className }: ProgressBarProps) {
  const pct = calcProgress(progress, duration);

  return (
    <View className={`h-0.5 bg-neutral-800 ${className ?? ""}`}>
      <View className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: color ?? ACCENT_COLOR }} />
    </View>
  );
}
