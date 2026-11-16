/**
 * @fileoverview ReceiptTheaterGuard — Receipt Theater Defense Model implementation.
 *
 * This component enforces the invariant that NO avatar-relative projection (screen/route)
 * may render until a valid BLAKE3 receipt keyed by `routeKey` is confirmed to exist in
 * persistent storage (SQLite via actorReceipts table, with MMKV fast-path fallback).
 *
 * Typestate machine:
 *   PENDING_VERIFICATION → VERIFIED      (receipt found & validated)
 *   PENDING_VERIFICATION → RECEIPT_MISSING (timeout / not found after 3s)
 *   RECEIPT_MISSING      → PENDING_VERIFICATION (retry requested)
 *   RECEIPT_MISSING      → ESCALATED     (escalate action taken)
 *   VERIFIED             → RENDER        (children are rendered — the terminal admitted state)
 *
 * OTel span `route.admission.verified` is emitted once per successful verification.
 *
 * @module @truex/membrane-client/route-law/ReceiptTheaterGuard
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { mmkvInstance } from '../lib/store/mmkvStorage';
import { blake3, canonicalStringify, verifyEcdsaSignature, sha256 } from '../lib/crypto/receipts';

// ─────────────────────────────────────────────────────────────────────────────
// Typestates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The finite states of the ReceiptTheaterGuard typestate machine.
 * Transitions are strictly controlled — no state is reachable unless permitted.
 */
export type ReceiptTheaterState =
  | { kind: 'PENDING_VERIFICATION' }
  | {
      kind: 'VERIFIED';
      receiptHash: string;
      verifiedAt: number;
      /** The canonical BLAKE3 hash that was confirmed */
      blake3Hash: string;
    }
  | {
      kind: 'RECEIPT_MISSING';
      reason: ReceiptMissingReason;
      elapsed: number;
    }
  | { kind: 'ESCALATED'; reason: ReceiptMissingReason };

export type ReceiptMissingReason =
  | 'RECEIPT_NOT_FOUND'
  | 'RECEIPT_HASH_MISMATCH'
  | 'VERIFICATION_ERROR'
  | 'TIMEOUT';

// ─────────────────────────────────────────────────────────────────────────────
// OTel span emission (lightweight, no native dependency required)
// ─────────────────────────────────────────────────────────────────────────────

export interface OTelSpan {
  name: string;
  traceId: string;
  spanId: string;
  startTime: number;
  endTime: number;
  attributes: Record<string, string | number | boolean>;
  status: 'OK' | 'ERROR';
}

/**
 * Emits an OTel-compatible span for `route.admission.verified`.
 * In production this would be forwarded to an OTel collector via OTLP/HTTP.
 * In the current runtime environment we record it in MMKV under the key
 * `otel:route.admission.verified:<routeKey>` and log it to console in dev.
 */
export function emitRouteAdmissionSpan(
  routeKey: string,
  blake3Hash: string,
  durationMs: number,
  status: 'OK' | 'ERROR',
  errorMessage?: string
): OTelSpan {
  const now = Date.now();
  const traceId = blake3(`trace:${routeKey}:${now}`).substring(0, 32);
  const spanId = blake3(`span:${routeKey}:${now}`).substring(0, 16);

  const span: OTelSpan = {
    name: 'route.admission.verified',
    traceId,
    spanId,
    startTime: now - durationMs,
    endTime: now,
    attributes: {
      'route.key': routeKey,
      'receipt.blake3_hash': blake3Hash,
      'receipt.duration_ms': durationMs,
      'admission.status': status === 'OK' ? 'admitted' : 'refused',
      ...(errorMessage ? { 'error.message': errorMessage } : {}),
    },
    status,
  };

  // Persist span to MMKV for local OTel pipeline pickup
  try {
    mmkvInstance.set(`otel:route.admission.verified:${routeKey}`, canonicalStringify(span));
  } catch {
    // MMKV unavailable — best-effort persistence only
  }

  if (__DEV__) {
    console.log('[OTel] route.admission.verified', JSON.stringify(span, null, 2));
  }

  return span;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt lookup — 3-tier fallback (MMKV → SQLite)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptLookupResult {
  found: boolean;
  blake3Hash: string;
  mismatched: boolean;
  error?: string;
}

/**
 * Performs the 3-tier receipt lookup for a given routeKey:
 *  Tier 1: MMKV synchronous fast-path (receipt JSON or raw hash)
 *  Tier 2: MMKV raw hash key
 *  Tier 3: SQLite actorReceipts table via drizzle-orm (async)
 *
 * @param routeKey The route key to look up the receipt for
 * @param expectedBlake3Hash Optional expected BLAKE3 hash to validate against
 */
export async function lookupReceiptForRoute(
  routeKey: string,
  expectedBlake3Hash?: string
): Promise<ReceiptLookupResult> {
  const isSecurePath = routeKey.startsWith('cmd_');

  // ── Tier 1: MMKV receipt JSON ──────────────────────────────────────────────
  try {
    const mmkvReceiptJson = mmkvInstance.getString(`receipt_${routeKey}`);
    if (mmkvReceiptJson) {
      const receipt = JSON.parse(mmkvReceiptJson);
      const actualHash: string = receipt.deltaHash ?? receipt.blake3Hash ?? '';

      if (isSecurePath) {
        const { signature, publicKey, ...unsignedReceipt } = receipt;
        if (!signature || !publicKey) {
          return {
            found: false,
            blake3Hash: actualHash,
            mismatched: false,
            error: 'Receipt signature or public key is missing for secure path',
          };
        }
        const messageHash = sha256(canonicalStringify(unsignedReceipt));
        const sigResult = verifyEcdsaSignature(messageHash, signature, publicKey);
        if (!sigResult.valid) {
          return {
            found: false,
            blake3Hash: actualHash,
            mismatched: false,
            error: `Receipt signature is invalid for secure path: ${sigResult.error}`,
          };
        }
      }

      if (expectedBlake3Hash) {
        if (actualHash === expectedBlake3Hash) {
          return { found: true, blake3Hash: actualHash, mismatched: false };
        }
        return {
          found: false,
          blake3Hash: actualHash,
          mismatched: true,
          error: `BLAKE3 hash mismatch. Expected: ${expectedBlake3Hash}, Actual: ${actualHash}`,
        };
      }
      return { found: true, blake3Hash: actualHash, mismatched: false };
    }
  } catch (parseErr: any) {
    // Corrupt MMKV receipt — fall through to next tier
  }

  // ── Tier 2: MMKV raw hash key ─────────────────────────────────────────────
  try {
    const mmkvHash = mmkvInstance.getString(`receipt_hash_${routeKey}`);
    if (mmkvHash) {
      if (isSecurePath) {
        return {
          found: false,
          blake3Hash: mmkvHash,
          mismatched: false,
          error: 'Receipt signature is missing for secure path (raw hash in MMKV)',
        };
      }
      if (expectedBlake3Hash) {
        if (mmkvHash === expectedBlake3Hash) {
          return { found: true, blake3Hash: mmkvHash, mismatched: false };
        }
        return {
          found: false,
          blake3Hash: mmkvHash,
          mismatched: true,
          error: `BLAKE3 hash mismatch (MMKV raw). Expected: ${expectedBlake3Hash}, Actual: ${mmkvHash}`,
        };
      }
      return { found: true, blake3Hash: mmkvHash, mismatched: false };
    }
  } catch {
    // MMKV unavailable — fall through
  }

  // ── Tier 3: SQLite actorReceipts ──────────────────────────────────────────
  try {
    const { db } = require('../lib/db/db');
    const { actorReceipts } = require('../lib/db/schema');
    const { eq } = require('drizzle-orm');

    const records: Array<{ deltaHash?: string | null; actorRef: string }> = await db
      .select()
      .from(actorReceipts)
      .where(eq(actorReceipts.commandId, routeKey));

    if (records.length > 0) {
      const record = records[0];
      const actualHash = record.deltaHash ?? '';

      if (isSecurePath) {
        let isSigValid = false;
        try {
          const receipt = JSON.parse(record.actorRef);
          const { signature, publicKey, ...unsignedReceipt } = receipt;
          if (signature && publicKey) {
            const messageHash = sha256(canonicalStringify(unsignedReceipt));
            const sigResult = verifyEcdsaSignature(messageHash, signature, publicKey);
            isSigValid = !!sigResult.valid;
          }
        } catch (e) {
          isSigValid = false;
        }

        if (!isSigValid) {
          return {
            found: false,
            blake3Hash: actualHash,
            mismatched: false,
            error: 'Receipt signature is invalid or unsigned in SQLite storage.',
          };
        }
      }

      if (expectedBlake3Hash) {
        if (actualHash === expectedBlake3Hash) {
          return { found: true, blake3Hash: actualHash, mismatched: false };
        }
        return {
          found: false,
          blake3Hash: actualHash,
          mismatched: true,
          error: `BLAKE3 hash mismatch (SQLite). Expected: ${expectedBlake3Hash}, Actual: ${actualHash}`,
        };
      }
      return { found: true, blake3Hash: actualHash, mismatched: false };
    }
  } catch (dbErr: any) {
    return {
      found: false,
      blake3Hash: '',
      mismatched: false,
      error: `SQLite lookup failed: ${dbErr?.message ?? String(dbErr)}`,
    };
  }

  return { found: false, blake3Hash: '', mismatched: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated verification overlay sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pulsing cryptographic lock animation displayed while verification is in progress.
 */
const VerifyingPulseOrb: React.FC = () => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const innerRotation = useSharedValue(0);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 900, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 700 }), withTiming(0.3, { duration: 700 })),
      -1,
      false
    );
    innerRotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const outerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const spinnerContainerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }],
  }));

  return (
    <View style={styles.orbContainer}>
      <Animated.View style={[styles.outerGlow, outerGlowStyle]} />
      <View style={styles.orbInner}>
        <Animated.View style={spinnerContainerStyle}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </Animated.View>
      </View>
    </View>
  );
};

/**
 * Failure orb displayed when receipt verification has failed.
 */
const FailureOrb: React.FC = () => {
  const shakeX = useSharedValue(0);
  const appear = useSharedValue(0);

  React.useEffect(() => {
    appear.value = withSpring(1, { damping: 12, stiffness: 120 });
    // Brief shake animation to signal failure
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: appear.value }, { translateX: shakeX.value }],
    opacity: appear.value,
  }));

  return (
    <Animated.View style={[styles.orbContainer, containerStyle]}>
      <View style={styles.outerGlowFailure} />
      <View style={styles.orbInnerFailure}>
        <FontAwesome name="exclamation-triangle" size={26} color="#F43F5E" />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CryptographicVerificationOverlay
// ─────────────────────────────────────────────────────────────────────────────

export interface CryptographicVerificationOverlayProps {
  routeKey: string;
  /** Whether receipt check is currently running */
  isVerifying: boolean;
  /** The missing/mismatch reason if verification has failed */
  missingReason: ReceiptMissingReason | null;
  /** Human-readable error detail */
  errorDetail: string | null;
  /** Expected BLAKE3 hash, shown for auditability */
  expectedBlake3Hash?: string;
  onRetry: () => void;
  onEscalate: () => void;
  escalateLabel?: string;
}

/**
 * Professional animated overlay displayed while the ReceiptTheaterGuard is
 * verifying the BLAKE3 receipt. This is the cryptographic gating UI that
 * enforces Receipt Theater — the route content is NEVER rendered beneath this.
 */
export const CryptographicVerificationOverlay: React.FC<CryptographicVerificationOverlayProps> = ({
  routeKey,
  isVerifying,
  missingReason,
  errorDetail,
  expectedBlake3Hash,
  onRetry,
  onEscalate,
  escalateLabel = 'Return to Safety',
}) => {
  const cardAppear = useSharedValue(0);
  const cardScale = useSharedValue(0.92);

  React.useEffect(() => {
    cardAppear.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) });
    cardScale.value = withSpring(1, { damping: 14, stiffness: 110 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardAppear.value,
    transform: [{ scale: cardScale.value }],
  }));

  const reasonLabel: Record<ReceiptMissingReason, string> = {
    RECEIPT_NOT_FOUND: 'Receipt Not Found',
    RECEIPT_HASH_MISMATCH: 'Hash Mismatch',
    VERIFICATION_ERROR: 'Verification Error',
    TIMEOUT: 'Verification Timed Out',
  };

  const reasonColor: Record<ReceiptMissingReason, string> = {
    RECEIPT_NOT_FOUND: '#F43F5E',
    RECEIPT_HASH_MISMATCH: '#F59E0B',
    VERIFICATION_ERROR: '#F43F5E',
    TIMEOUT: '#F59E0B',
  };

  return (
    <View style={styles.overlayRoot}>
      {/* Ambient background glows */}
      <View style={styles.ambientGlowTop} />
      <View style={styles.ambientGlowBottom} />

      <Animated.View style={[styles.card, cardStyle]}>
        {/* Header area with orb */}
        <View style={styles.headerArea}>
          {isVerifying ? <VerifyingPulseOrb /> : <FailureOrb />}

          <Text style={styles.titleText}>
            {isVerifying ? 'Verifying Cryptographic Receipt' : 'Admission Blocked'}
          </Text>
          <Text style={styles.subtitleText}>
            {isVerifying
              ? 'BLAKE3 Receipt Theater Enforcement Active'
              : `Receipt Theater Guard: ${missingReason ? reasonLabel[missingReason] : 'Unknown Failure'}`}
          </Text>
        </View>

        {/* Metadata panel */}
        <View style={styles.metadataPanel}>
          {/* Proof level badge row */}
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Proof Level</Text>
            {isVerifying ? (
              <View style={styles.badgeVerifying}>
                <View style={styles.badgeDotVerifying} />
                <Text style={styles.badgeTextVerifying}>BLAKE3 • Tier-3 Fallback</Text>
              </View>
            ) : missingReason === 'RECEIPT_HASH_MISMATCH' ? (
              <View style={styles.badgeMismatch}>
                <View style={styles.badgeDotMismatch} />
                <Text style={[styles.badgeTextMismatch, { color: reasonColor[missingReason] }]}>
                  {reasonLabel[missingReason]}
                </Text>
              </View>
            ) : (
              <View style={styles.badgeMissing}>
                <View style={styles.badgeDotMissing} />
                <Text style={styles.badgeTextMissing}>
                  {missingReason ? reasonLabel[missingReason] : 'Missing Proof'}
                </Text>
              </View>
            )}
          </View>

          {/* Route key */}
          <View style={styles.metadataField}>
            <Text style={styles.metadataFieldLabel}>Route Key (commandId)</Text>
            <View style={styles.monoBox}>
              <Text style={styles.monoText} numberOfLines={1}>
                {routeKey}
              </Text>
              <FontAwesome name="key" size={11} color="#64748B" />
            </View>
          </View>

          {/* Expected BLAKE3 hash */}
          {expectedBlake3Hash ? (
            <View style={[styles.metadataField, styles.metadataFieldBorderTop]}>
              <Text style={styles.metadataFieldLabel}>Expected BLAKE3 Hash</Text>
              <View style={styles.monoBox}>
                <Text style={styles.monoTextHash} numberOfLines={1}>
                  {expectedBlake3Hash}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Verification status badge */}
          <View style={[styles.metadataRow, styles.metadataFieldBorderTop]}>
            <Text style={styles.metadataLabel}>Signature Status</Text>
            {isVerifying ? (
              <View style={styles.statusChecking}>
                <Text style={styles.statusCheckingText}>Checking…</Text>
              </View>
            ) : !missingReason ? (
              <View style={styles.statusOk}>
                <Text style={styles.statusOkText}>Verified ✅</Text>
              </View>
            ) : (
              <View style={styles.statusFailed}>
                <Text style={styles.statusFailedText}>Unverified ❌</Text>
              </View>
            )}
          </View>
        </View>

        {/* Error detail block */}
        {!isVerifying && errorDetail ? (
          <View style={styles.errorBlock}>
            <View style={styles.errorBlockHeader}>
              <FontAwesome name="shield" size={13} color="#F43F5E" />
              <Text style={styles.errorBlockTitle}>
                {`Refusal (${missingReason ?? 'UNKNOWN'})`}
              </Text>
            </View>
            <Text style={styles.errorBlockBody}>{errorDetail}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionArea}>
          {!isVerifying ? (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.82}
              style={styles.retryButton}
              testID="receipt-theater-retry-btn"
            >
              <FontAwesome name="refresh" size={13} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry Verification</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={onEscalate}
            activeOpacity={0.82}
            style={styles.escalateButton}
            testID="receipt-theater-escalate-btn"
          >
            <Text style={styles.escalateButtonText}>
              {isVerifying ? 'Cancel & Return' : escalateLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ReceiptTheaterGuard — primary export
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptTheaterGuardProps {
  /**
   * The route key used to look up the BLAKE3 receipt.
   * Maps to `commandId` in the actorReceipts SQLite table and MMKV keys
   * `receipt_<routeKey>` / `receipt_hash_<routeKey>`.
   */
  routeKey: string;

  /**
   * Optional expected BLAKE3 hash. When supplied, the guard validates that
   * the stored receipt's deltaHash matches this value exactly.
   */
  expectedBlake3Hash?: string;

  /**
   * Content to render after the receipt is successfully verified.
   * This is NEVER rendered until VERIFIED state is reached.
   */
  children: React.ReactNode;

  /**
   * Timeout in milliseconds before transitioning to RECEIPT_MISSING/TIMEOUT.
   * @default 3000
   */
  timeoutMs?: number;

  /**
   * Called when the user chooses to escalate (navigate away) from the
   * receipt_missing error state. Useful for analytics or routing override.
   */
  onEscalate?: (routeKey: string, reason: ReceiptMissingReason) => void;

  /**
   * Label for the escalate/return button.
   * @default 'Return to Safety'
   */
  escalateLabel?: string;

  /**
   * Custom loading overlay to render during PENDING_VERIFICATION.
   * If provided, replaces the default CryptographicVerificationOverlay.
   */
  loadingOverride?: React.ReactNode;

  /**
   * Custom error overlay to render during RECEIPT_MISSING / ESCALATED.
   * If provided, replaces the default CryptographicVerificationOverlay.
   */
  errorOverride?: ((state: ReceiptTheaterState) => React.ReactNode) | React.ReactNode;

  /**
   * When true, MMKV listener subscription is enabled to auto-refresh when
   * a receipt key is written to MMKV after the guard has mounted.
   * @default true
   */
  subscribeToMMKV?: boolean;
}

/**
 * ReceiptTheaterGuard — the canonical Receipt Theater enforcement component.
 *
 * Blocks rendering of children until a BLAKE3 receipt confirmed in
 * SQLite/MMKV is found for the given `routeKey`. Shows an animated
 * cryptographic verification overlay while checking, and transitions to
 * a `receipt_missing` error state with retry/escalate options if the
 * receipt is not found within `timeoutMs` (default 3 seconds).
 *
 * Upon successful verification, emits an OTel span `route.admission.verified`.
 *
 * Usage:
 * ```tsx
 * <ReceiptTheaterGuard routeKey="cmd_onboarding_complete">
 *   <MyProtectedScreen />
 * </ReceiptTheaterGuard>
 * ```
 */
export const ReceiptTheaterGuard: React.FC<ReceiptTheaterGuardProps> = ({
  routeKey,
  expectedBlake3Hash,
  children,
  timeoutMs = 3000,
  onEscalate,
  escalateLabel = 'Return to Safety',
  loadingOverride,
  errorOverride,
  subscribeToMMKV = true,
}) => {
  const [theaterState, setTheaterState] = React.useState<ReceiptTheaterState>({
    kind: 'PENDING_VERIFICATION',
  });

  // Track when verification started for OTel span duration
  const verifyStartRef = React.useRef<number>(Date.now());

  // Track the active timeout handle so we can cancel it on unmount or early resolution
  const timeoutHandleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core verification logic ────────────────────────────────────────────────

  const runVerification = React.useCallback(
    async (isActive: { current: boolean }) => {
      if (!isActive.current) return;

      verifyStartRef.current = Date.now();

      setTheaterState({ kind: 'PENDING_VERIFICATION' });

      // Enforce timeout — race the lookup against the deadline
      // Store the handle so it can be cancelled
      const timeoutPromise = new Promise<ReceiptLookupResult>((resolve) => {
        timeoutHandleRef.current = setTimeout(
          () =>
            resolve({
              found: false,
              blake3Hash: '',
              mismatched: false,
              error: `Verification timed out after ${timeoutMs}ms`,
            }),
          timeoutMs
        );
      });

      let result: ReceiptLookupResult;
      try {
        result = await Promise.race([
          lookupReceiptForRoute(routeKey, expectedBlake3Hash).then((r) => {
            // Cancel the timeout if lookup resolves first
            if (timeoutHandleRef.current !== null) {
              clearTimeout(timeoutHandleRef.current);
              timeoutHandleRef.current = null;
            }
            return r;
          }),
          timeoutPromise,
        ]);
      } catch (unexpectedErr: any) {
        result = {
          found: false,
          blake3Hash: '',
          mismatched: false,
          error: `Unexpected error: ${unexpectedErr?.message ?? String(unexpectedErr)}`,
        };
      }

      // Cancel timeout if still running (e.g., the timeout resolved first but
      // lookup finished shortly after — no harm calling clearTimeout on already-fired handles)
      if (timeoutHandleRef.current !== null) {
        clearTimeout(timeoutHandleRef.current);
        timeoutHandleRef.current = null;
      }

      if (!isActive.current) return;

      const durationMs = Date.now() - verifyStartRef.current;

      if (result.found) {
        // ── Transition: PENDING_VERIFICATION → VERIFIED ──────────────────────
        emitRouteAdmissionSpan(routeKey, result.blake3Hash, durationMs, 'OK');
        setTheaterState({
          kind: 'VERIFIED',
          receiptHash: result.blake3Hash,
          verifiedAt: Date.now(),
          blake3Hash: result.blake3Hash,
        });
      } else {
        // ── Determine the specific missing reason ─────────────────────────────
        let reason: ReceiptMissingReason = 'RECEIPT_NOT_FOUND';
        if (result.mismatched) {
          reason = 'RECEIPT_HASH_MISMATCH';
        } else if (result.error?.startsWith('Unexpected error')) {
          reason = 'VERIFICATION_ERROR';
        } else if (result.error?.includes('timed out')) {
          reason = 'TIMEOUT';
        } else if (result.error?.startsWith('SQLite lookup failed')) {
          reason = 'VERIFICATION_ERROR';
        }

        emitRouteAdmissionSpan(routeKey, result.blake3Hash, durationMs, 'ERROR', result.error);

        // ── Transition: PENDING_VERIFICATION → RECEIPT_MISSING ───────────────
        setTheaterState({
          kind: 'RECEIPT_MISSING',
          reason,
          elapsed: durationMs,
        });
      }
    },
    [routeKey, expectedBlake3Hash, timeoutMs]
  );

  // ── Mount effect + MMKV subscription ─────────────────────────────────────

  React.useEffect(() => {
    const isActive = { current: true };
    let mmkvListener: { remove: () => void } | null = null;

    runVerification(isActive);

    if (subscribeToMMKV) {
      try {
        mmkvListener = mmkvInstance.addOnValueChangedListener((key: string) => {
          if (key === `receipt_${routeKey}` || key === `receipt_hash_${routeKey}`) {
            // A new receipt appeared in MMKV — re-run verification automatically
            runVerification(isActive);
          }
        });
      } catch {
        // MMKV subscription unavailable — polling not used, receipt must be
        // present at mount time or user must trigger manual retry
      }
    }

    return () => {
      isActive.current = false;
      mmkvListener?.remove();
      // Cancel any pending verification timeout to prevent open handle leaks
      if (timeoutHandleRef.current !== null) {
        clearTimeout(timeoutHandleRef.current);
        timeoutHandleRef.current = null;
      }
    };
  }, [routeKey, subscribeToMMKV, runVerification]);

  // ── Render the typestate machine ──────────────────────────────────────────

  const handleRetry = React.useCallback(() => {
    const isActive = { current: true };
    runVerification(isActive);
  }, [runVerification]);

  const handleEscalate = React.useCallback(() => {
    const currentState = theaterState;
    const reason: ReceiptMissingReason =
      currentState.kind === 'RECEIPT_MISSING' || currentState.kind === 'ESCALATED'
        ? (currentState as any).reason
        : 'RECEIPT_NOT_FOUND';

    setTheaterState({ kind: 'ESCALATED', reason });
    onEscalate?.(routeKey, reason);
  }, [theaterState, routeKey, onEscalate]);

  switch (theaterState.kind) {
    case 'VERIFIED':
      // ── RENDER — the only state that allows children to be shown ────────────
      return <>{children}</>;

    case 'PENDING_VERIFICATION': {
      if (loadingOverride !== undefined) {
        return <>{loadingOverride}</>;
      }
      return (
        <CryptographicVerificationOverlay
          routeKey={routeKey}
          isVerifying={true}
          missingReason={null}
          errorDetail={null}
          expectedBlake3Hash={expectedBlake3Hash}
          onRetry={handleRetry}
          onEscalate={handleEscalate}
          escalateLabel={escalateLabel}
        />
      );
    }

    case 'RECEIPT_MISSING': {
      if (errorOverride !== undefined) {
        if (typeof errorOverride === 'function') {
          return <>{errorOverride(theaterState)}</>;
        }
        return <>{errorOverride}</>;
      }
      const missingState = theaterState;
      return (
        <CryptographicVerificationOverlay
          routeKey={routeKey}
          isVerifying={false}
          missingReason={missingState.reason}
          errorDetail={buildErrorDetail(missingState.reason, routeKey, expectedBlake3Hash)}
          expectedBlake3Hash={expectedBlake3Hash}
          onRetry={handleRetry}
          onEscalate={handleEscalate}
          escalateLabel={escalateLabel}
        />
      );
    }

    case 'ESCALATED': {
      if (errorOverride !== undefined) {
        if (typeof errorOverride === 'function') {
          return <>{errorOverride(theaterState)}</>;
        }
        return <>{errorOverride}</>;
      }
      const escalatedState = theaterState;
      return (
        <CryptographicVerificationOverlay
          routeKey={routeKey}
          isVerifying={false}
          missingReason={escalatedState.reason}
          errorDetail={buildErrorDetail(escalatedState.reason, routeKey, expectedBlake3Hash)}
          expectedBlake3Hash={expectedBlake3Hash}
          onRetry={handleRetry}
          onEscalate={handleEscalate}
          escalateLabel={escalateLabel}
        />
      );
    }

    default: {
      // Exhaustive typestate check — this branch is physically unreachable
      const _exhaustive: never = theaterState;
      return null;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build human-readable error detail string
// ─────────────────────────────────────────────────────────────────────────────

function buildErrorDetail(
  reason: ReceiptMissingReason,
  routeKey: string,
  expectedHash?: string
): string {
  switch (reason) {
    case 'RECEIPT_NOT_FOUND':
      return (
        `Required BLAKE3 receipt for route '${routeKey}' was not found in any ` +
        `local storage tier (MMKV, SQLite). Complete the prerequisite action to generate the receipt.`
      );
    case 'RECEIPT_HASH_MISMATCH':
      return (
        `A receipt was found for route '${routeKey}' but its BLAKE3 hash does not ` +
        `match the required value${expectedHash ? ` (${expectedHash})` : ''}. ` +
        `This may indicate tampered state or a version mismatch.`
      );
    case 'VERIFICATION_ERROR':
      return (
        `An unexpected error occurred while verifying the BLAKE3 receipt for route ` +
        `'${routeKey}'. The storage subsystem may be unavailable. Please retry.`
      );
    case 'TIMEOUT':
      return (
        `BLAKE3 receipt verification for route '${routeKey}' did not complete within ` +
        `the allowed time. This may indicate storage latency or a deadlock. Please retry.`
      );
    default: {
      const _exhaustive: never = reason;
      return `Unknown verification failure for route '${routeKey}'.`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: '#020617', // slate-950
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  ambientGlowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -60,
    left: -60,
  },
  ambientGlowBottom: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(139, 92, 246, 0.07)',
    bottom: -60,
    right: -60,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', // slate-900/95
    borderWidth: 1,
    borderColor: '#1e293b', // slate-800
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  orbContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  outerGlow: {
    position: 'absolute',
    inset: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
  },
  orbInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  outerGlowFailure: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  orbInnerFailure: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9', // slate-100
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8', // slate-400
    textAlign: 'center',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metadataPanel: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.8)',
  },
  metadataLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metadataField: {
    marginBottom: 10,
  },
  metadataFieldBorderTop: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.6)',
    paddingTop: 10,
    marginBottom: 0,
  },
  metadataFieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  monoBox: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monoText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#cbd5e1',
    flex: 1,
    marginRight: 6,
  },
  monoTextHash: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  badgeVerifying: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDotVerifying: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
    marginRight: 5,
  },
  badgeTextVerifying: {
    fontSize: 9,
    fontWeight: '700',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeMismatch: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDotMismatch: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 5,
  },
  badgeTextMismatch: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeMissing: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDotMissing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F43F5E',
    marginRight: 5,
  },
  badgeTextMissing: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fb7185',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusChecking: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusCheckingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusOk: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusOkText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4ade80',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusFailed: {
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    borderWidth: 1,
    borderColor: '#991b1b',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusFailedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f87171',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBlock: {
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(153, 27, 27, 0.3)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorBlockTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fb7185',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginLeft: 6,
  },
  errorBlockBody: {
    fontSize: 12,
    color: 'rgba(254, 202, 202, 0.9)',
    lineHeight: 18,
    fontWeight: '500',
  },
  actionArea: {
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  escalateButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
  },
  escalateButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default ReceiptTheaterGuard;
