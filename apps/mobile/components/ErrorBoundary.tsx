import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";

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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scrollView}>
            <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
            {this.state.errorInfo && (
              <Text style={styles.stackText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 20,
    marginTop: 50,
  },
  scrollView: {
    width: "100%",
    maxHeight: 500,
  },
  errorText: {
    fontSize: 16,
    color: "#B91C1C",
    marginBottom: 20,
    fontFamily: "monospace",
  },
  stackText: {
    fontSize: 12,
    color: "#7F1D1D",
    fontFamily: "monospace",
  },
});
