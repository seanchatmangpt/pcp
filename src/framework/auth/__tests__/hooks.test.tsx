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
      resolveParticipant={resolveParticipant}>
      {children}
    </AuthProvider>
  );

  const loadingWrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider
      getInitialSession={() => new Promise(() => {})}
      resolveParticipant={resolveParticipant}>
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

  describe('useRBAC', () => {
    it('evaluates roles and permissions correctly', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('guest')).toBe(false);

      expect(result.current.hasPermission('read')).toBe(true);
      expect(result.current.hasPermission('delete')).toBe(false);

      expect(result.current.hasAnyRole(['guest', 'admin'])).toBe(true);
      expect(result.current.hasAnyRole(['guest', 'superadmin'])).toBe(false);

      expect(result.current.hasAllRoles(['admin', 'user'])).toBe(true);
      expect(result.current.hasAllRoles(['admin', 'guest'])).toBe(false);

      expect(result.current.hasAnyPermission(['delete', 'write'])).toBe(true);
      expect(result.current.hasAnyPermission(['delete', 'update'])).toBe(false);

      expect(result.current.hasAllPermissions(['read', 'write'])).toBe(true);
      expect(result.current.hasAllPermissions(['read', 'delete'])).toBe(false);

      expect(result.current.roles).toEqual(['admin', 'user']);
      expect(result.current.permissions).toEqual(['read', 'write']);
    });

    it('returns defaults when no participant is resolved', () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: loadingWrapper });
      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasPermission('read')).toBe(false);
      expect(result.current.hasAnyRole(['admin'])).toBe(false);
      expect(result.current.hasAllRoles(['admin'])).toBe(false);
      expect(result.current.hasAnyPermission(['read'])).toBe(false);
      expect(result.current.hasAllPermissions(['read'])).toBe(false);
      expect(result.current.roles).toEqual([]);
      expect(result.current.permissions).toEqual([]);
    });
  });

  describe('useRole and usePermission', () => {
    it('useRole returns correct boolean', async () => {
      const { result: roleTrue } = renderHook(() => useRole('admin'), { wrapper });
      const { result: roleFalse } = renderHook(() => useRole('guest'), { wrapper });

      await waitFor(() => {
        expect(roleTrue.current).toBe(true);
      });
      expect(roleFalse.current).toBe(false);
    });

    it('usePermission returns correct boolean', async () => {
      const { result: permTrue } = renderHook(() => usePermission('read'), { wrapper });
      const { result: permFalse } = renderHook(() => usePermission('delete'), { wrapper });

      await waitFor(() => {
        expect(permTrue.current).toBe(true);
      });
      expect(permFalse.current).toBe(false);
    });
  });
});
