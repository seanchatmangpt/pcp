/**
 * @fileoverview Generic guard checking functions.
 */

import { ParticipantBasis, RouteDefinition, AdmitRouteResult, IdentityBoundary } from './types';

export const DEFAULT_IDENTITY_HIERARCHY: readonly IdentityBoundary[] = [
  'anonymous',
  'authenticated',
  'verified',
  'mfa_verified',
];

/**
 * Pure checking function that evaluates whether a participant meets a route's gating requirements.
 */
export function admitRoute(
  participant: ParticipantBasis | null | undefined,
  route: RouteDefinition,
  hierarchy: readonly IdentityBoundary[] = DEFAULT_IDENTITY_HIERARCHY
): AdmitRouteResult {
  const activeParticipant: ParticipantBasis = participant ?? {
    identityBoundary: 'anonymous',
    disclosures: [],
  };

  if (route.requiredIdentityBoundary) {
    const requiredIndex = hierarchy.indexOf(route.requiredIdentityBoundary);
    const actualIndex = hierarchy.indexOf(activeParticipant.identityBoundary);

    if (requiredIndex === -1) {
      return {
        admitted: false,
        refusal: {
          code: 'INVALID_CONFIGURATION',
          message: `Required identity boundary "${route.requiredIdentityBoundary}" is not recognized in the hierarchy configuration.`,
          requiredIdentityBoundary: route.requiredIdentityBoundary,
          actualIdentityBoundary: activeParticipant.identityBoundary,
        },
      };
    }

    if (
      activeParticipant.identityBoundary === 'anonymous' &&
      route.requiredIdentityBoundary !== 'anonymous'
    ) {
      return {
        admitted: false,
        refusal: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required to access this route.',
          requiredIdentityBoundary: route.requiredIdentityBoundary,
          actualIdentityBoundary: activeParticipant.identityBoundary,
        },
      };
    }

    if (actualIndex < requiredIndex) {
      return {
        admitted: false,
        refusal: {
          code: 'INSUFFICIENT_IDENTITY_LEVEL',
          message: `Identity level "${activeParticipant.identityBoundary}" is insufficient. Required: "${route.requiredIdentityBoundary}".`,
          requiredIdentityBoundary: route.requiredIdentityBoundary,
          actualIdentityBoundary: activeParticipant.identityBoundary,
        },
      };
    }
  }

  if (route.requiredDisclosures && route.requiredDisclosures.length > 0) {
    const participantDisclosuresSet = new Set(activeParticipant.disclosures);
    const missingDisclosures = route.requiredDisclosures.filter(
      (disclosure) => !participantDisclosuresSet.has(disclosure)
    );

    if (missingDisclosures.length > 0) {
      return {
        admitted: false,
        refusal: {
          code: 'MISSING_DISCLOSURE',
          message: `Missing required disclosure(s): ${missingDisclosures.join(', ')}.`,
          missingDisclosures,
        },
      };
    }
  }

  if (route.requiredRoles && route.requiredRoles.length > 0) {
    const participantRolesSet = new Set(activeParticipant.roles || []);
    const missingRoles = route.requiredRoles.filter((role) => !participantRolesSet.has(role));

    if (missingRoles.length > 0) {
      return {
        admitted: false,
        refusal: {
          code: 'MISSING_ROLE',
          message: `Missing required role(s): ${missingRoles.join(', ')}.`,
          missingRoles,
        },
      };
    }
  }

  if (route.requiredPermissions && route.requiredPermissions.length > 0) {
    const participantPermissionsSet = new Set(activeParticipant.permissions || []);
    const missingPermissions = route.requiredPermissions.filter(
      (permission) => !participantPermissionsSet.has(permission)
    );

    if (missingPermissions.length > 0) {
      return {
        admitted: false,
        refusal: {
          code: 'MISSING_PERMISSION',
          message: `Missing required permission(s): ${missingPermissions.join(', ')}.`,
          missingPermissions,
        },
      };
    }
  }

  if (route.customGuard) {
    const customRefusal = route.customGuard(activeParticipant);
    if (customRefusal) {
      return {
        admitted: false,
        refusal: customRefusal,
      };
    }
  }

  return { admitted: true };
}
