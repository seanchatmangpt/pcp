import React from 'react';
import { render, act, waitFor, renderHook } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { ProtectedRoute } from '../ProtectedRoute';
import { admitRoute, DEFAULT_IDENTITY_HIERARCHY } from '../guards';
import { useSession, useParticipant, useRBAC, useRole, usePermission } from '../hooks';
import { ParticipantBasis } from '../types';

const TestComponent = () => {
  const { session, loading, isTransitioning, transitionType, setSession } = useAuth<{ name: string }>();

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

const resolveParticipant = (session: any): ParticipantBasis => ({
  identityBoundary: session?.level || session?.identityBoundary || 'anonymous',
  disclosures: session?.disclosures || [],
  roles: session?.roles || [],
  permissions: session?.permissions || [],
});

describe('Authentication & Route Gating Core Layer', () => {
  describe('guards: admitRoute', () => {
    it('evaluates access permissions correctly', () => {
      // allows access if no restrictions are specified
      expect(admitRoute(undefined, {}).admitted).toBe(true);

      // rejects if required boundary is invalid
      const r1 = admitRoute(undefined, { requiredIdentityBoundary: 'unknown' });
      expect(r1.admitted).toBe(false);
      expect(r1.refusal?.code).toBe('INVALID_CONFIGURATION');

      // rejects unauthenticated users trying to access protected route
      const r2 = admitRoute(
        { identityBoundary: 'anonymous', disclosures: [] },
        { requiredIdentityBoundary: 'authenticated' }
      );
      expect(r2.admitted).toBe(false);
      expect(r2.refusal?.code).toBe('UNAUTHENTICATED');

      // allows authenticated users
      const r3 = admitRoute(
        { identityBoundary: 'authenticated', disclosures: [] },
        { requiredIdentityBoundary: 'authenticated' }
      );
      expect(r3.admitted).toBe(true);
    });
  });

  describe('AuthProvider Component', () => {
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

    it('resolves initial session and catches errors correctly', async () => {
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

      // Test error fallback
      const getFailedSession = jest.fn().mockRejectedValue(new Error('Failed'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const renderResult = render(
        <AuthProvider getInitialSession={getFailedSession}>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(renderResult.queryByText('Loading...')).toBeNull();
      });
      errorSpy.mockRestore();
    });
  });

  describe('ProtectedRoute Component', () => {
    it('gates rendering based on authentication level', async () => {
      const getInitialSession = () => new Promise<any>(() => {});
      
      // 1. Shows loading state
      const { getByText, queryByText, rerender } = render(
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

      // 2. Renders children if admitted
      const getAdmittedSession = () => Promise.resolve({ level: 'authenticated' });
      rerender(
        <AuthProvider getInitialSession={getAdmittedSession}>
          <ProtectedRoute
            route={{ requiredIdentityBoundary: 'authenticated' }}
            resolveParticipant={resolveParticipant}
            loadingComponent={<Text>AuthLoading</Text>}
          >
            <Text>Protected Content</Text>
          </ProtectedRoute>
        </AuthProvider>
      );
      await waitFor(() => {
        expect(queryByText('Protected Content')).toBeTruthy();
      });

      // 3. Renders fallback if access denied
      const getDeniedSession = () => Promise.resolve({ level: 'anonymous' });
      rerender(
        <AuthProvider getInitialSession={getDeniedSession}>
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

  describe('Auth Hooks & RBAC', () => {
    const mockSession = { user: 'test', level: 'authenticated', roles: ['admin', 'user'], permissions: ['read', 'write'] };
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider
        getInitialSession={() => Promise.resolve(mockSession)}
        resolveParticipant={resolveParticipant}
      >
        {children}
      </AuthProvider>
    );

    const loadingWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider
        getInitialSession={() => new Promise(() => {})}
        resolveParticipant={resolveParticipant}
      >
        {children}
      </AuthProvider>
    );

    it('useSession returns session state', async () => {
      const { result } = renderHook(() => useSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.session).toEqual(mockSession);
    });

    it('useParticipant returns participant basis and handles loading state', async () => {
      const { result: activeResult } = renderHook(() => useParticipant(), { wrapper });
      await waitFor(() => {
        expect(activeResult.current.loading).toBe(false);
      });
      expect(activeResult.current.participant?.identityBoundary).toBe('authenticated');

      const { result: loadingResult } = renderHook(() => useParticipant(), { wrapper: loadingWrapper });
      expect(loadingResult.current.participant).toBeNull();
      expect(loadingResult.current.loading).toBe(true);
    });

    it('useRBAC evaluates roles and permissions correctly', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('guest')).toBe(false);
      expect(result.current.hasPermission('read')).toBe(true);
      expect(result.current.hasPermission('delete')).toBe(false);

      expect(result.current.hasAnyRole(['user', 'guest'])).toBe(true);
      expect(result.current.hasAllRoles(['admin', 'user'])).toBe(true);
      expect(result.current.hasAllRoles(['admin', 'guest'])).toBe(false);

      expect(result.current.hasAnyPermission(['write', 'delete'])).toBe(true);
      expect(result.current.hasAllPermissions(['read', 'write'])).toBe(true);
    });
  });
});
