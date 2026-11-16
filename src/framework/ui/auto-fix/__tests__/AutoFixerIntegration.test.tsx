import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AutoFixErrorBoundary } from '../AutoFixErrorBoundary';
import { AutoFixer } from '../AutoFixer';
import { analyzeError } from '../analyzer';
import * as analyzer from '../analyzer';

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  const mockClearAll = jest.fn();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      clearAll: mockClearAll,
    })),
    createMMKV: jest.fn().mockReturnValue({
      clearAll: mockClearAll,
      clear: jest.fn(),
    }),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(),
  removeItem: jest.fn(),
}));

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

describe('Auto-Fixer Unified Integration Suite', () => {
  const onErrorMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress react-native or react console errors during testing
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        {ui}
      </SafeAreaProvider>
    );
  };

  // Part 1: Error Analyzer Diagnostics and Recovery Selections
  describe('Error Analyzer (analyzeError)', () => {
    it('correctly selects Scaffold Component for Semantic/RDF failures', () => {
      const error = new Error('Missing semantic component for type user-profile');
      const analysis = analyzeError(error);

      expect(analysis.causes).toContain('Missing semantic component configuration or RDF type mapping.');
      expect(analysis.suggestions.map((s) => s.id)).toEqual(
        expect.arrayContaining(['scaffold-component', 'diagnostics', 'rollback'])
      );
    });

    it('correctly selects Wipe State for state-related failures matching older syntax', () => {
      const error = new Error('cannot read property "name" of undefined');
      const analysis = analyzeError(error);

      expect(analysis.isStateRelated).toBe(true);
      expect(analysis.causes).toContain('Potential corrupted local state or unexpected data structure.');
      expect(analysis.suggestions.map((s) => s.id)).toEqual(
        expect.arrayContaining(['wipe-state', 'diagnostics', 'rollback'])
      );
    });

    it('correctly detects state corruption under modern JS engine null/undefined error messages', () => {
      const error = new Error('Cannot read properties of null (reading "toString")');
      const analysis = analyzeError(error);

      expect(analysis.isStateRelated).toBe(true);
      expect(analysis.suggestions.map((s) => s.id)).toContain('wipe-state');
    });

    it('correctly selects Reset Session and Schema Sync for network/auth failures', () => {
      const error = new Error('Supabase network error: failed to fetch');
      const analysis = analyzeError(error);

      expect(analysis.causes).toContain('Network or authentication failure.');
      expect(analysis.suggestions.map((s) => s.id)).toEqual(
        expect.arrayContaining(['re-auth', 'db-drift-sync', 'diagnostics', 'rollback'])
      );
    });

    it('handles standard/unknown errors with generic diagnostics and rollback', () => {
      const error = new Error('Generic logic bug');
      const analysis = analyzeError(error);

      expect(analysis.causes).toHaveLength(0);
      expect(analysis.isStateRelated).toBe(false);
      expect(analysis.suggestions.map((s) => s.id)).toEqual(['diagnostics', 'rollback']);
    });

    describe('Adversarial vulnerability checks', () => {
      it('handles a raw string gracefully instead of crashing', () => {
        const errorString = 'Something broke' as any;
        const analysis = analyzeError(errorString);
        expect(analysis).toBeDefined();
        expect(analysis.suggestions.map((s) => s.id)).toContain('rollback');
      });

      it('handles null and undefined gracefully instead of crashing', () => {
        const analysisNull = analyzeError(null as any);
        expect(analysisNull).toBeDefined();
        expect(analysisNull.suggestions.map((s) => s.id)).toContain('rollback');

        const analysisUndefined = analyzeError(undefined as any);
        expect(analysisUndefined).toBeDefined();
        expect(analysisUndefined.suggestions.map((s) => s.id)).toContain('rollback');
      });

      it('handles a plain object without message gracefully instead of crashing', () => {
        const errorObj = { code: 500 } as any;
        const analysis = analyzeError(errorObj);
        expect(analysis).toBeDefined();
        expect(analysis.suggestions.map((s) => s.id)).toContain('rollback');
      });
    });
  });

  // Part 2: AutoFixer Component UI and Actions
  describe('AutoFixer Component', () => {
    const mockOnReset = jest.fn();
    const testError = new Error('Test Error');

    it('renders correctly with suggestions', () => {
      const spy = jest.spyOn(analyzer, 'analyzeError').mockReturnValue({
        causes: ['Test cause'],
        isStateRelated: false,
        suggestions: [
          {
            id: 'fix-1',
            title: 'Fix 1',
            description: 'Description 1',
            impact: 'low',
            action: jest.fn(),
          },
        ],
      });

      const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

      expect(getByText('Pcp Intelligent Repair')).toBeTruthy();
      expect(getByText('• Test cause')).toBeTruthy();
      expect(getByText('Fix 1')).toBeTruthy();
      expect(getByText('Description 1')).toBeTruthy();

      spy.mockRestore();
    });

    it('calls action and onReset when a suggestion is pressed', async () => {
      const mockAction = jest.fn();
      const spy = jest.spyOn(analyzer, 'analyzeError').mockReturnValue({
        causes: [],
        isStateRelated: false,
        suggestions: [
          {
            id: 'fix-1',
            title: 'Fix 1',
            description: 'Description 1',
            impact: 'low',
            action: mockAction,
          },
        ],
      });

      const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

      fireEvent.press(getByText('Fix 1'));

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalled();
        expect(mockOnReset).toHaveBeenCalled();
      });

      spy.mockRestore();
    });

    it('handles action failure gracefully', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Action failed'));
      const spy = jest.spyOn(analyzer, 'analyzeError').mockReturnValue({
        causes: [],
        isStateRelated: false,
        suggestions: [
          {
            id: 'fix-1',
            title: 'Fix 1',
            description: 'Description 1',
            impact: 'low',
            action: mockAction,
          },
        ],
      });

      const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

      fireEvent.press(getByText('Fix 1'));

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
        expect(mockOnReset).not.toHaveBeenCalled();
      });

      spy.mockRestore();
    });
  });

  // Part 3: AutoFixErrorBoundary Logic
  describe('AutoFixErrorBoundary', () => {
    it('renders children when no error occurs', () => {
      const { getByText } = renderWithProvider(
        <AutoFixErrorBoundary>
          <Text>Safe Content</Text>
        </AutoFixErrorBoundary>
      );
      expect(getByText('Safe Content')).toBeTruthy();
    });

    it('renders fallback UI and intelligent auto fixer when an error occurs', () => {
      const { getByText } = renderWithProvider(
        <AutoFixErrorBoundary onError={onErrorMock}>
          <ThrowError message="Crashed!" />
        </AutoFixErrorBoundary>
      );

      expect(getByText('Something went wrong')).toBeTruthy();
      expect(getByText('Crashed!')).toBeTruthy();
      expect(getByText('Pcp Intelligent Repair')).toBeTruthy();
      expect(onErrorMock).toHaveBeenCalled();
    });

    it('resets error state when retry is pressed', async () => {
      const { getByText, getByTestId, queryByText, rerender } = renderWithProvider(
        <AutoFixErrorBoundary>
          <ThrowError message="Crashed!" shouldThrow={true} />
        </AutoFixErrorBoundary>
      );

      rerender(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 0, height: 0 },
            insets: { top: 0, left: 0, right: 0, bottom: 0 },
          }}
        >
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
  });
});
