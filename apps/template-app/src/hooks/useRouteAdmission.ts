/**
 * @fileoverview React Hook to evaluate route admission constraints programmatically.
 */

import { useSession } from '../../context/SessionProvider';
import { admitRoute, DEFAULT_IDENTITY_HIERARCHY } from '../route-law/guards';
import { defaultResolveParticipant } from '../route-law/ProtectedRoute';
import { createRouteAdmissionHook } from '@pcp/framework/data';

/**
 * Custom hook to check if the current user/session meets the requirements for a route.
 * Re-exported from the framework factory.
 */
export const useRouteAdmission = createRouteAdmissionHook({
  useSession,
  defaultResolveParticipant,
  defaultHierarchy: DEFAULT_IDENTITY_HIERARCHY,
  admitRoute,
});

export type { UseRouteAdmissionOptions, UseRouteAdmissionResult } from '@pcp/framework/data';
