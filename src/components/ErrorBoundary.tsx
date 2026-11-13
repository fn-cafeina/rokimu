import { Feather } from "@expo/vector-icons";
import React, { type ErrorInfo, type ReactNode, Component } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { MUTED_ICON } from "@/config/source";
import { logger } from "@/utils/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnRetry?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary", `Component error: ${error.message}`, error);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.props.resetOnRetry !== false) {
      this.setState({ hasError: false, error: null });
    }
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback != null && this.props.fallback !== false) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-surface px-8">
          <Feather name="alert-circle" size={44} color={MUTED_ICON} />
          <Text className="mt-4 text-center text-base font-medium text-on-surface">
            Algo salió mal
          </Text>
          <Text className="mt-2 max-w-[300px] text-center text-sm text-on-surface-variant">
            {this.state.error?.message ?? "Error inesperado"}
          </Text>
          <Button
            label="Reintentar"
            variant="tonal"
            onPress={this.handleRetry}
            className="mt-5"
          />
        </View>
      );
    }

    return this.props.children;
  }
}
