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
          loadingComponent={<Text>AuthLoading</Text>}
        >
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
          resolveParticipant={resolveParticipant}
        >
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
          fallback={<Text>Access Denied</Text>}
        >
          <Text>Protected Content</Text>
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(queryByText('Access Denied')).toBeTruthy();
    });
  });
});
