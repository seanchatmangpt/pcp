import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { AutoFixer } from './AutoFixer';

export interface AutoFixErrorBoundaryProps {
  /** The child components to render */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to enable intelligent auto-fixing suggestions */
  enableAutoFix?: boolean;
}

export interface AutoFixErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  autoFixerCrashed: boolean;
}

/**
 * Enhanced ErrorBoundary with Intelligent Auto-Fixing capabilities.
 * Extends standard error handling with analysis-driven recovery options.
 * Incorporates an "Iron Law" fallback to prevent infinite crashing loops.
 */
export class AutoFixErrorBoundary extends Component<
  AutoFixErrorBoundaryProps,
  AutoFixErrorBoundaryState
> {
  constructor(props: AutoFixErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, autoFixerCrashed: false };
  }

  static defaultProps = {
    enableAutoFix: true,
  };

  static getDerivedStateFromError(error: Error): AutoFixErrorBoundaryState {
    return { hasError: true, error, autoFixerCrashed: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    // Log to external service could go here
    console.error('[AutoFixErrorBoundary] caught error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, autoFixerCrashed: false });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Iron Law: If the AutoFixer or custom fallback crashes, render absolute raw primitives
      if (this.state.autoFixerCrashed) {
        return (
          <SafeAreaView
            style={{ flex: 1, backgroundColor: '#000', padding: 20, justifyContent: 'center' }}>
            <Text style={{ color: 'red', fontSize: 24, fontWeight: 'bold' }}>FATAL ERROR</Text>
            <Text style={{ color: 'white', marginTop: 10 }}>The recovery system has crashed.</Text>
            <TouchableOpacity
              onPress={this.resetError}
              style={{ marginTop: 20, padding: 15, backgroundColor: '#333' }}>
              <Text style={{ color: 'white', textAlign: 'center' }}>FORCE RELOAD</Text>
            </TouchableOpacity>
          </SafeAreaView>
        );
      }

      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.resetError);
      }
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.message}>{this.state.error.message}</Text>
            </View>

            {this.props.enableAutoFix && (
              <AutoFixer error={this.state.error} onReset={this.resetError} />
            )}

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.resetError}
              testID="auto-fix-retry-button">
              <Text style={styles.retryButtonText}>Standard Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
});
