import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../AuthProvider';
import { Text } from 'react-native';

const resolveParticipant = (session: any) => ({
  identityBoundary: session?.level || 'anonymous',
  disclosures: session?.disclosures || [],
});

describe('ProtectedRoute', () => {
  it('shows loading state while auth is loading', () => {
    const getInitialSession = () => new Promise<any>(() => {});
    const { getByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          loadingComponent={<Text>AuthLoading</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    expect(getByText('AuthLoading')).toBeTruthy();
  });

  it('renders children if admitted', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Protected Content')).toBeTruthy();
    });
  });

  it('renders fallback if access denied', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'anonymous' });
    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          fallback={<Text>Access Denied</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Access Denied')).toBeTruthy();
    });
  });

  it('renders function fallback if access denied', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'anonymous' });
    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          fallback={(refusal) => <Text>Access Denied: {refusal.code}</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Access Denied: UNAUTHENTICATED')).toBeTruthy();
    });
  });

  it('renders external checking component and handles refusal with function fallback', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const verifyExternalState = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ verified: false, refusal: { code: 'NO_RECEIPT', message: 'Missing receipt' } });
        }, 100);
      });
    });

    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          verifyExternalState={verifyExternalState}
          externalCheckingComponent={<Text>Checking Receipt</Text>}
          fallback={(refusal) => <Text>{refusal.message}</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Checking Receipt')).toBeTruthy();
    });

    await waitFor(() => {
      expect(queryByText('Missing receipt')).toBeTruthy();
    });
  });

  it('renders external checking component and handles refusal with standard fallback', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const verifyExternalState = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ verified: false, refusal: { code: 'NO_RECEIPT', message: 'Missing receipt' } });
        }, 100);
      });
    });

    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          verifyExternalState={verifyExternalState}
          externalCheckingComponent={<Text>Checking Receipt</Text>}
          fallback={<Text>Fallback Node</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Fallback Node')).toBeTruthy();
    });
  });

  it('renders children if external state verified', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const verifyExternalState = jest.fn().mockResolvedValue({ verified: true });

    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          verifyExternalState={verifyExternalState}
          externalCheckingComponent={<Text>Checking Receipt</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Protected Content')).toBeTruthy();
    });
  });

  it('handles external state rejection', async () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const verifyExternalState = jest.fn().mockRejectedValue(new Error('Network error'));

    const { queryByText } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          verifyExternalState={verifyExternalState}
          externalCheckingComponent={<Text>Checking Receipt</Text>}
          fallback={(refusal) => <Text>{refusal.message}</Text>}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Network error')).toBeTruthy();
    });
  });

  it('cleans up verification when unmounted early', () => {
    const getInitialSession = () => Promise.resolve({ level: 'authenticated' });
    const verifyExternalState = jest.fn().mockReturnValue(new Promise(() => {}));

    const { unmount } = render(
      <AuthProvider getInitialSession={getInitialSession}>
        <ProtectedRoute
          route={{ requiredIdentityBoundary: 'authenticated' }}
          resolveParticipant={resolveParticipant}
          verifyExternalState={verifyExternalState}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    unmount();
  });
});
