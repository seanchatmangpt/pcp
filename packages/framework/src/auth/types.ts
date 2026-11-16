/**
 * @fileoverview Generic Type definitions for the Framework's Auth and Route Gating layer.
 */

export type IdentityBoundary = string;

export type Disclosure = string;

export type Role = string;

export type Permission = string;

export interface RefusalReason {
  code: string;
  message: string;
  requiredIdentityBoundary?: IdentityBoundary;
  actualIdentityBoundary?: IdentityBoundary;
  missingDisclosures?: readonly Disclosure[];
  missingRoles?: readonly Role[];
  missingPermissions?: readonly Permission[];
  [key: string]: any; // Extensible for custom properties like requiredReceiptCommandId
}

export interface ParticipantBasis {
  identityBoundary: IdentityBoundary;
  disclosures: readonly Disclosure[];
  roles?: readonly Role[];
  permissions?: readonly Permission[];
  [key: string]: any; // Extensible for custom session data
}

export interface RouteDefinition {
  requiredIdentityBoundary?: IdentityBoundary;
  requiredDisclosures?: readonly Disclosure[];
  requiredRoles?: readonly Role[];
  requiredPermissions?: readonly Permission[];
  customGuard?: (participant: ParticipantBasis) => RefusalReason | null;
  [key: string]: any; // Extensible for custom routing logic
}

export interface AdmitRouteResult {
  admitted: boolean;
  refusal?: RefusalReason;
}
