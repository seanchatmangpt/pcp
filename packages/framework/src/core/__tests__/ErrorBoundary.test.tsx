import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { Text } from 'react-native';

const ProblemChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test Error');
  }
  return <Text testID="content">All Good</Text>;
};

describe('ErrorBoundary', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('content').props.children).toBe('All Good');
  });

  it('renders default fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test Error')).toBeTruthy();
  });

  it('allows retrying from default fallback UI', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Update props so it won't throw on the next render
    rerender(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByTestId('error-boundary-retry');
    fireEvent.press(retryButton);

    expect(screen.getByTestId('content')).toBeTruthy();
  });
});
