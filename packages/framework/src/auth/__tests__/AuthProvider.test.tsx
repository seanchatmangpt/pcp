import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { Text, View } from 'react-native';

const TestComponent = () => {
  const { session, loading, isTransitioning, transitionType, setSession } = useAuth();

  if (loading) return <Text>Loading...</Text>;

  return (
    <View>
      <Text testID="session">{session ? session.name : 'null'}</Text>
      <Text testID="transitioning">{isTransitioning ? 'true' : 'false'}</Text>
      <Text testID="transitionType">{transitionType || 'null'}</Text>
      <Text testID="setSession" onPress={() => setSession(null)}>
        Set Session Null
      </Text>
    </View>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('provides loading state initially if resolving async', async () => {
    const getInitialSession = jest.fn().mockReturnValue(new Promise(() => {}));
    const { getByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <TestComponent />
      </AuthProvider>
    );

    expect(getByText('Loading...')).toBeTruthy();
  });

  it('resolves initial session and stops loading', async () => {
    const getInitialSession = jest.fn().mockResolvedValue({ name: 'Alice' });
    const { getByTestId, queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Loading...')).toBeNull();
    });

    expect(getByTestId('session').props.children).toBe('Alice');
  });

  it('catches error in initial session and stops loading', async () => {
    const getInitialSession = jest.fn().mockRejectedValue(new Error('Failed'));
    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Loading...')).toBeNull();
    });
  });
});
