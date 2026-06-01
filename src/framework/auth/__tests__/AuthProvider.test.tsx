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

  it('handles auth state changes before initialization', async () => {
    let triggerAuthChange: any;
    const onAuthStateChange = jest.fn((callback) => {
      triggerAuthChange = callback;
      return () => {};
    });

    const getInitialSession = jest.fn().mockReturnValue(new Promise(() => {}));

    const { getByTestId, queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession} onAuthStateChange={onAuthStateChange}>
        <TestComponent />
      </AuthProvider>
    );

    expect(queryByText('Loading...')).toBeTruthy();

    act(() => {
      triggerAuthChange('SIGNED_IN', { name: 'Bob' });
    });

    await waitFor(() => {
      expect(queryByText('Loading...')).toBeNull();
    });

    expect(getByTestId('session').props.children).toBe('Bob');
  });

  it('handles auth state changes', async () => {
    let triggerAuthChange: any;
    const onAuthStateChange = jest.fn((callback) => {
      triggerAuthChange = callback;
      return () => {};
    });

    const { getByTestId, queryByText } = render(
      <AuthProvider onAuthStateChange={onAuthStateChange}>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Loading...')).toBeNull();
    });

    act(() => {
      triggerAuthChange('SIGNED_IN', { name: 'Bob' });
    });

    expect(getByTestId('session').props.children).toBe('Bob');
    expect(getByTestId('transitioning').props.children).toBe('true');
    expect(getByTestId('transitionType').props.children).toBe('signin');

    act(() => {
      jest.advanceTimersByTime(850);
    });

    expect(getByTestId('transitioning').props.children).toBe('false');

    act(() => {
      triggerAuthChange('SIGNED_OUT', null);
    });

    expect(getByTestId('transitioning').props.children).toBe('true');
    expect(getByTestId('transitionType').props.children).toBe('signout');
  });

  it('handles setSession from context', async () => {
    const { getByTestId, queryByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Loading...')).toBeNull();
    });

    act(() => {
      getByTestId('setSession').props.onPress();
    });

    expect(getByTestId('transitioning').props.children).toBe('false');
  });

  it('unmounts cleanly during async session fetch', () => {
    const getInitialSession = jest.fn().mockReturnValue(new Promise(() => {}));
    const { unmount } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <TestComponent />
      </AuthProvider>
    );
    unmount();
  });
});
