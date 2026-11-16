/**
 * @fileoverview Declarative hooks for Role-Based Access Control and Session Management.
 */

import { useAuth, AuthContextValue } from './AuthProvider';
import { Role, Permission, ParticipantBasis } from './types';

/**
 * Hook to retrieve the current authentication session.
 */
export function useSession<TUser = any>(): Pick<
  AuthContextValue<TUser>,
  'session' | 'loading' | 'isTransitioning' | 'transitionType'
> {
  const { session, loading, isTransitioning, transitionType } = useAuth<TUser>();
  return { session, loading, isTransitioning, transitionType };
}

/**
 * Hook to retrieve the currently resolved participant basis.
 */
export function useParticipant(): { participant: ParticipantBasis | null; loading: boolean } {
  const { participant, loading } = useAuth();
  return { participant, loading };
}

/**
 * Hook to evaluate roles and permissions for the active participant.
 */
export function useRBAC() {
  const { participant, loading } = useParticipant();

  const roles = participant?.roles || [];
  const permissions = participant?.permissions || [];

  const hasRole = (role: Role) => roles.includes(role);
  const hasPermission = (permission: Permission) => permissions.includes(permission);

  const hasAnyRole = (rolesToCheck: readonly Role[]) => rolesToCheck.some(hasRole);
  const hasAllRoles = (rolesToCheck: readonly Role[]) => rolesToCheck.every(hasRole);

  const hasAnyPermission = (permissionsToCheck: readonly Permission[]) =>
    permissionsToCheck.some(hasPermission);
  const hasAllPermissions = (permissionsToCheck: readonly Permission[]) =>
    permissionsToCheck.every(hasPermission);

  return {
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    hasAnyPermission,
    hasAllPermissions,
    roles,
    permissions,
    loading,
  };
}

/**
 * Declarative hook returning true if the participant has a specific role.
 */
export function useRole(role: Role): boolean {
  return useRBAC().hasRole(role);
}

/**
 * Declarative hook returning true if the participant has a specific permission.
 */
export function usePermission(permission: Permission): boolean {
  return useRBAC().hasPermission(permission);
}
