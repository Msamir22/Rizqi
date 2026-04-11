import React, { Component, ErrorInfo, ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import i18next from "i18next";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-red-100 p-5 justify-center items-center">
          <Text className="text-2xl font-bold text-red-600 mb-5 mt-[50px]">
            {i18next.t("common:error_boundary_message")}
          </Text>
          <ScrollView className="w-full max-h-[500px]">
            <Text
              className="text-base text-red-700 mb-5"
              style={{ fontFamily: "monospace" }}
            >
              {this.state.error?.toString()}
            </Text>
            {this.state.errorInfo && (
              <Text
                className="text-xs text-red-900"
                style={{ fontFamily: "monospace" }}
              >
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
