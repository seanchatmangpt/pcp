/**
 * @fileoverview Type definitions for the Typestate Gating framework.
 * Defines the core typestates (IdentityBoundary), requirements (Disclosure),
 * participant context (ParticipantBasis), and route constraints (RouteDefinition).
 */

/**
 * IdentityBoundary represents the typestate of the participant's identity/authentication level.
 * Standard levels could be 'anonymous', 'authenticated', 'verified', 'mfa_verified', etc.
 */
export type IdentityBoundary = string;

/**
 * Disclosure represents a claim, consent, or verification token acknowledged by the participant.
 * E.g., 'email_verified', 'phone_verified', 'terms_accepted', 'profile_completed'.
 */
export type Disclosure = string;

/**
 * Details why admission to a guarded route was denied.
 */
export interface RefusalReason {
  /** Machine-readable error code */
  code:
    | 'UNAUTHENTICATED'
    | 'INSUFFICIENT_IDENTITY_LEVEL'
    | 'MISSING_DISCLOSURE'
    | 'CUSTOM_GUARD_FAILED'
    | 'INVALID_CONFIGURATION'
    | string;
  /** Human-readable explanation of why access was denied */
  message: string;
  /** The specific identity boundary level required, if applicable */
  requiredIdentityBoundary?: IdentityBoundary;
  /** The current identity boundary level of the participant, if applicable */
  actualIdentityBoundary?: IdentityBoundary;
  /** Disclosures that were required but missing from the participant, if applicable */
  missingDisclosures?: readonly Disclosure[];
}

/**
 * The minimal structure representing the participant attempting to access a route.
 */
export interface ParticipantBasis {
  /** The current identity boundary state of the participant */
  identityBoundary: IdentityBoundary;
  /** The list of disclosures the participant has acknowledged/provided */
  disclosures: readonly Disclosure[];
}

/**
 * Definition of admission requirements for a given route.
 */
export interface RouteDefinition {
  /**
   * The minimum required identity boundary to access the route.
   * If not specified, any identity level (including anonymous) is allowed.
   */
  requiredIdentityBoundary?: IdentityBoundary;

  /**
   * List of disclosures/consents that must be satisfied.
   */
  requiredDisclosures?: readonly Disclosure[];

  /**
   * Optional custom guard function for complex gating logic.
   * Returns a RefusalReason if denied, or null if admitted.
   */
  customGuard?: (participant: ParticipantBasis) => RefusalReason | null;

  /**
   * Optional command/action ID of a BLAKE3 receipt that must exist in local storage
   * (SQLite/MMKV) for this route/projection to unlock.
   */
  requiredReceiptCommandId?: string;

  /**
   * Optional expected BLAKE3 hash of the receipt to match.
   */
  requiredReceiptDeltaHash?: string;
}
