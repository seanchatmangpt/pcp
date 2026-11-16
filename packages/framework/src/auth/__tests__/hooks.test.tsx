import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSession, useParticipant, useRBAC, useRole, usePermission } from '../hooks';
import { AuthProvider } from '../AuthProvider';

const mockParticipant = {
  identityBoundary: 'authenticated',
  disclosures: [],
  roles: ['admin', 'user'],
  permissions: ['read', 'write'],
};

const mockSession = { user: 'test' };
const resolveParticipant = () => mockParticipant;

describe('Auth Hooks', () => {
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

  describe('useSession', () => {
    it('returns session state', async () => {
      const { result } = renderHook(() => useSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.session).toEqual(mockSession);
    });
  });

  describe('useParticipant', () => {
    it('returns participant basis', async () => {
      const { result } = renderHook(() => useParticipant(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.participant).toEqual(mockParticipant);
    });

    it('handles loading state correctly without failing', () => {
      const { result } = renderHook(() => useParticipant(), { wrapper: loadingWrapper });
      expect(result.current.participant).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });
});
