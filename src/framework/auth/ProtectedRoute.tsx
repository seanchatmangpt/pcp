import React, { useEffect, useState } from 'react';
import { RouteDefinition, ParticipantBasis, RefusalReason, IdentityBoundary } from './types';
import { admitRoute, DEFAULT_IDENTITY_HIERARCHY } from './guards';
import { useAuth } from './AuthProvider';

export interface ProtectedRouteProps {
  /** The gating requirements for the protected route */
  route: RouteDefinition;

  /** Content to render if the participant is admitted */
  children: React.ReactNode;

  /** Function to resolve a custom participant from session */
  resolveParticipant: (session: any) => ParticipantBasis;

  /** Component or render prop to show while loading session */
  loadingComponent?: React.ReactNode;

  /** Component or render prop to handle refused access */
  fallback?: React.ReactNode | ((refusal: RefusalReason) => React.ReactNode);

  /** Function to asynchronously verify external state like receipts or deep DB checks */
  verifyExternalState?: (
    route: RouteDefinition
  ) => Promise<{ verified: boolean; refusal?: RefusalReason }>;

  /** Component to render while checking external state */
  externalCheckingComponent?: React.ReactNode;

  /** Optional explicit hierarchy */
  hierarchy?: readonly IdentityBoundary[];

  /** Optional explicit participant basis to bypass default session check */
  participant?: ParticipantBasis;
}

/**
 * ProtectedRoute component that gates access to child components.
 * Abstract framework component decoupled from specific UI/routing libraries.
 */
export function ProtectedRoute({
  route,
  children,
  resolveParticipant,
  loadingComponent = null,
  fallback = null,
  verifyExternalState,
  externalCheckingComponent = null,
  hierarchy = DEFAULT_IDENTITY_HIERARCHY,
  participant,
}: ProtectedRouteProps) {
  const { session, participant: contextParticipant, loading, isTransitioning } = useAuth();

  const [checkingExternal, setCheckingExternal] = useState(!!verifyExternalState);
  const [externalRefusal, setExternalRefusal] = useState<RefusalReason | null>(null);

  useEffect(() => {
    let active = true;

    if (verifyExternalState) {
      setCheckingExternal(true);
      verifyExternalState(route)
        .then(({ verified, refusal }) => {
          if (active) {
            setExternalRefusal(
              verified
                ? null
                : (refusal ?? { code: 'EXTERNAL_CHECK_FAILED', message: 'Verification failed' })
            );
            setCheckingExternal(false);
          }
        })
        .catch((err) => {
          if (active) {
            setExternalRefusal({
              code: 'EXTERNAL_CHECK_ERROR',
              message: err?.message || String(err),
            });
            setCheckingExternal(false);
          }
        });
    } else {
      setCheckingExternal(false);
      setExternalRefusal(null);
    }

    return () => {
      active = false;
    };
  }, [verifyExternalState, route]);

  if ((loading || isTransitioning) && !participant) {
    return <>{loadingComponent}</>;
  }

  const activeParticipant =
    participant ?? (resolveParticipant ? resolveParticipant(session) : contextParticipant);
  const { admitted, refusal } = admitRoute(activeParticipant, route, hierarchy);

  if (!admitted) {
    const activeRefusal = refusal ?? { code: 'REFUSED', message: 'Access denied.' };
    if (typeof fallback === 'function') {
      return <>{fallback(activeRefusal)}</>;
    }
    return <>{fallback}</>;
  }

  if (checkingExternal) {
    return <>{externalCheckingComponent}</>;
  }

  if (externalRefusal) {
    if (typeof fallback === 'function') {
      return <>{fallback(externalRefusal)}</>;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
