/**
 * @fileoverview Pure guard checking functions for the Typestate Gating framework.
 * Houses the core business rules for route admission, including BLAKE3 receipt
 * enforcement via the Receipt Theater defense model.
 */

import { ParticipantBasis, RouteDefinition, RefusalReason, IdentityBoundary } from './types';
import { mmkvInstance } from '../lib/store/mmkvStorage';

/**
 * Default hierarchy of identity boundaries, from least verified/trusted to most verified/trusted.
 */
export const DEFAULT_IDENTITY_HIERARCHY: readonly IdentityBoundary[] = [
  'anonymous',
  'authenticated',
  'verified',
  'mfa_verified',
];

/**
 * Result structure of a route admission check.
 */
export interface AdmitRouteResult {
  /** True if the participant meets all constraints of the route */
  admitted: boolean;
  /** Detailed reason if the participant is refused, otherwise undefined */
  refusal?: RefusalReason;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireReceiptBeforeRender — Receipt Theater integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The result of a receipt pre-admission check.
 */
export interface ReceiptGuardResult {
  /** True only when a valid BLAKE3 receipt was confirmed in local storage */
  receiptConfirmed: boolean;
  /**
   * The confirmed BLAKE3 hash of the receipt if found.
   * Empty string when not found.
   */
  confirmedBlake3Hash: string;
  /**
   * The specific reason the receipt was rejected, or null when confirmed.
   * Aligned with `ReceiptMissingReason` from ReceiptTheaterGuard.
   */
  rejectionReason: 'RECEIPT_NOT_FOUND' | 'RECEIPT_HASH_MISMATCH' | 'VERIFICATION_ERROR' | null;
  /** Human-readable explanation of the rejection, or null when confirmed */
  rejectionMessage: string | null;
}

/**
 * Synchronous receipt pre-admission guard that enforces the Receipt Theater invariant.
 *
 * Performs a 2-tier synchronous lookup (MMKV receipt JSON → MMKV raw hash key)
 * before allowing access to a route.  SQLite (async) lookup is intentionally
 * excluded from this synchronous path — for the full 3-tier async lookup see
 * `lookupReceiptForRoute` in `ReceiptTheaterGuard.tsx`.
 *
 * This function is designed to be used as a `customGuard` inside `RouteDefinition`
 * or called imperatively as a pre-flight admission check before navigation.
 *
 * Typestate contract:
 *   - Returns `receiptConfirmed: true`  → Witnessed<ReceiptGuardResult>
 *   - Returns `receiptConfirmed: false` → Claimed<ReceiptGuardResult>  (never trusted)
 *
 * @param routeKey The route key (commandId) to look up the receipt for.
 *                 Must match the key used when the receipt was stored.
 * @param expectedBlake3Hash Optional BLAKE3 hash that must match the stored receipt's deltaHash.
 *                           When omitted, any receipt for the routeKey is accepted.
 * @returns A `ReceiptGuardResult` describing whether the receipt was confirmed.
 *
 * @example
 * // As a customGuard in RouteDefinition:
 * const route: RouteDefinition = {
 *   customGuard: (participant) => {
 *     const result = requireReceiptBeforeRender('cmd_onboarding_complete');
 *     if (!result.receiptConfirmed) {
 *       return {
 *         code: result.rejectionReason ?? 'RECEIPT_NOT_FOUND',
 *         message: result.rejectionMessage ?? 'Receipt missing.',
 *       };
 *     }
 *     return null;
 *   },
 * };
 *
 * @example
 * // Imperative pre-flight check:
 * const result = requireReceiptBeforeRender('cmd_payment_authorized', expectedHash);
 * if (!result.receiptConfirmed) {
 *   router.replace('/(auth)/missing-receipt');
 * }
 */
export function requireReceiptBeforeRender(
  routeKey: string,
  expectedBlake3Hash?: string
): ReceiptGuardResult {
  if (!routeKey || routeKey.trim() === '') {
    return {
      receiptConfirmed: false,
      confirmedBlake3Hash: '',
      rejectionReason: 'VERIFICATION_ERROR',
      rejectionMessage: 'requireReceiptBeforeRender: routeKey must be a non-empty string.',
    };
  }

  // ── Tier 1: MMKV receipt JSON ──────────────────────────────────────────────
  try {
    const mmkvReceiptJson = mmkvInstance.getString(`receipt_${routeKey}`);
    if (mmkvReceiptJson) {
      let receipt: Record<string, unknown>;
      let parseError = false;
      try {
        receipt = JSON.parse(mmkvReceiptJson);
      } catch {
        // Corrupt JSON in MMKV — treat as not found, fall through to tier 2
        receipt = {};
        parseError = true;
      }

      const actualHash = String(
        (receipt.deltaHash as string) ?? (receipt.blake3Hash as string) ?? ''
      );

      // Only treat as a mismatch if the JSON was valid AND contained a real hash.
      // If the JSON was corrupt (empty actualHash from parseError), fall through.
      if (!parseError && actualHash) {
        if (expectedBlake3Hash) {
          if (actualHash === expectedBlake3Hash) {
            return {
              receiptConfirmed: true,
              confirmedBlake3Hash: actualHash,
              rejectionReason: null,
              rejectionMessage: null,
            };
          }
          // Valid JSON with a real hash that doesn't match — explicit security failure
          return {
            receiptConfirmed: false,
            confirmedBlake3Hash: actualHash,
            rejectionReason: 'RECEIPT_HASH_MISMATCH',
            rejectionMessage:
              `BLAKE3 receipt for route '${routeKey}' was found in MMKV but its ` +
              `hash does not match. Expected: ${expectedBlake3Hash}, Actual: ${actualHash}. ` +
              `This may indicate tampered state.`,
          };
        }
        // No hash constraint — valid receipt presence is sufficient
        return {
          receiptConfirmed: true,
          confirmedBlake3Hash: actualHash,
          rejectionReason: null,
          rejectionMessage: null,
        };
      }
      // Fall through: either corrupt JSON or valid JSON with no hash field
    }
  } catch (mmkvErr: any) {
    // MMKV access error — fall through to tier 2
  }

  // ── Tier 2: MMKV raw hash key ─────────────────────────────────────────────
  try {
    const rawHash = mmkvInstance.getString(`receipt_hash_${routeKey}`);
    if (rawHash) {
      if (expectedBlake3Hash) {
        if (rawHash === expectedBlake3Hash) {
          return {
            receiptConfirmed: true,
            confirmedBlake3Hash: rawHash,
            rejectionReason: null,
            rejectionMessage: null,
          };
        }
        return {
          receiptConfirmed: false,
          confirmedBlake3Hash: rawHash,
          rejectionReason: 'RECEIPT_HASH_MISMATCH',
          rejectionMessage:
            `BLAKE3 receipt hash for route '${routeKey}' was found in MMKV (raw key) ` +
            `but does not match. Expected: ${expectedBlake3Hash}, Actual: ${rawHash}.`,
        };
      }
      return {
        receiptConfirmed: true,
        confirmedBlake3Hash: rawHash,
        rejectionReason: null,
        rejectionMessage: null,
      };
    }
  } catch (mmkvErr2: any) {
    return {
      receiptConfirmed: false,
      confirmedBlake3Hash: '',
      rejectionReason: 'VERIFICATION_ERROR',
      rejectionMessage:
        `MMKV storage access failed during receipt guard check for route '${routeKey}': ` +
        `${mmkvErr2?.message ?? String(mmkvErr2)}`,
    };
  }

  // ── Not found in any synchronous tier ─────────────────────────────────────
  return {
    receiptConfirmed: false,
    confirmedBlake3Hash: '',
    rejectionReason: 'RECEIPT_NOT_FOUND',
    rejectionMessage:
      `No BLAKE3 receipt found for route '${routeKey}' in synchronous storage ` +
      `(MMKV). Use ReceiptTheaterGuard for the full 3-tier async lookup including SQLite.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// admitRoute — primary participant typestate admission check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure checking function that evaluates whether a participant meets a route's gating requirements.
 *
 * @param participant The participant seeking admission (null/undefined defaults to anonymous with no disclosures)
 * @param route The route definition containing the required constraints
 * @param hierarchy The ordering of identity boundaries from least to most trusted
 * @returns An object indicating admission status and optional refusal reason
 */
export function admitRoute(
  participant: ParticipantBasis | null | undefined,
  route: RouteDefinition,
  hierarchy: readonly IdentityBoundary[] = DEFAULT_IDENTITY_HIERARCHY
): AdmitRouteResult {
  // 1. Resolve participant state. If null/undefined, treat as anonymous with no disclosures.
  const activeParticipant: ParticipantBasis = participant ?? {
    identityBoundary: 'anonymous',
    disclosures: [],
  };

  // 2. Evaluate identity boundary requirement if specified
  if (route.requiredIdentityBoundary) {
    const requiredIndex = hierarchy.indexOf(route.requiredIdentityBoundary);
    const actualIndex = hierarchy.indexOf(activeParticipant.identityBoundary);

    // If required identity boundary is not in hierarchy, configuration is invalid
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

    // Check if participant is anonymous but route requires an authenticated/higher identity
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

    // Check if actual boundary is lower than required boundary in the hierarchy
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

  // 3. Evaluate required disclosures
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

  // 4. Run custom guard if specified
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
