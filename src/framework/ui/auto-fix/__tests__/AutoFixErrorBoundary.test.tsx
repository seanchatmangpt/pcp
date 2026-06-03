import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AutoFixErrorBoundary } from '../AutoFixErrorBoundary';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock AutoFixer to avoid deep rendering issues in boundary test
jest.mock('../AutoFixer', () => {
  const React = require('react');
  const { Text, View, TouchableOpacity } = require('react-native');
  return {
    AutoFixer: ({ onReset }: any) => (
      <View testID="mock-auto-fixer">
        <TouchableOpacity onPress={onReset}>
          <Text>Mock Fix</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  return {
    createMMKV: jest.fn(() => ({
      set: jest.fn(),
      getString: jest.fn(),
      remove: jest.fn(),
      clearAll: jest.fn(),
    })),
    MMKV: jest.fn().mockImplementation(() => ({
      clearAll: jest.fn(),
    })),
  };
});

const ThrowError = ({
  message,
  shouldThrow = true,
}: {
  message: string;
  shouldThrow?: boolean;
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <Text>Safe Content</Text>;
};

describe('AutoFixErrorBoundary', () => {
  const onErrorMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent React from logging the error to console during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        {ui}
      </SafeAreaProvider>
    );
  };

  it('renders children when no error occurs', () => {
    const { getByText } = renderWithProvider(
      <AutoFixErrorBoundary>
        <Text>Safe Content</Text>
      </AutoFixErrorBoundary>
    );
    expect(getByText('Safe Content')).toBeTruthy();
  });

  it('renders fallback UI when an error occurs', () => {
    const { getByText, getByTestId } = renderWithProvider(
      <AutoFixErrorBoundary onError={onErrorMock}>
        <ThrowError message="Crashed!" />
      </AutoFixErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Crashed!')).toBeTruthy();
    expect(getByTestId('mock-auto-fixer')).toBeTruthy();
    expect(onErrorMock).toHaveBeenCalled();
  });

  it('resets error state when retry is pressed', async () => {
    const { getByText, getByTestId, queryByText, rerender } = renderWithProvider(
      <AutoFixErrorBoundary>
        <ThrowError message="Crashed!" shouldThrow={true} />
      </AutoFixErrorBoundary>
    );

    // Update children to not throw anymore BEFORE resetting
    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        <AutoFixErrorBoundary>
          <ThrowError message="Crashed!" shouldThrow={false} />
        </AutoFixErrorBoundary>
      </SafeAreaProvider>
    );

    fireEvent.press(getByTestId('auto-fix-retry-button'));

    await waitFor(() => {
      expect(queryByText('Something went wrong')).toBeNull();
      expect(getByText('Safe Content')).toBeTruthy();
    });
  });

  it('resets error state when auto-fix onReset is called', async () => {
    const { getByText, rerender } = renderWithProvider(
      <AutoFixErrorBoundary>
        <ThrowError message="Crashed!" shouldThrow={true} />
      </AutoFixErrorBoundary>
    );

    // Update children to not throw anymore BEFORE resetting
    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        <AutoFixErrorBoundary>
          <ThrowError message="Crashed!" shouldThrow={false} />
        </AutoFixErrorBoundary>
      </SafeAreaProvider>
    );

    fireEvent.press(getByText('Mock Fix'));

    await waitFor(() => {
      expect(getByText('Safe Content')).toBeTruthy();
    });
  });

  it('can disable auto-fix UI via props', () => {
    const { queryByTestId } = renderWithProvider(
      <AutoFixErrorBoundary enableAutoFix={false}>
        <ThrowError message="Crashed!" />
      </AutoFixErrorBoundary>
    );

    expect(queryByTestId('mock-auto-fixer')).toBeNull();
  });
});
