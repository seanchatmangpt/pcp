/**
 * @fileoverview React component for guarding routes.
 * Integrates with Expo Router and SessionProvider to enforce admission checks.
 */

import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSession } from '@/context/SessionProvider';
import { useActorOpsStore } from '../lib/actor/actorOps';
import { mmkvInstance } from '../lib/store/mmkvStorage';
import { admitRoute, DEFAULT_IDENTITY_HIERARCHY } from './guards';
import { RouteDefinition, ParticipantBasis, RefusalReason, IdentityBoundary } from './types';
import { verifyEcdsaSignature, sha256, canonicalStringify } from '../lib/crypto/receipts';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

/**
 * Props for the ProtectedRoute component.
 */
export interface ProtectedRouteProps {
  /** The gating requirements for the protected route */
  route: RouteDefinition;
  /** Content to render if the participant is admitted */
  children: React.ReactNode;
  /**
   * Optional custom redirect destination path if admission is refused.
   * If not specified, defaults to '/(auth)' for unauthenticated users and '/' for other refusal types.
   */
  redirectPath?: string;
  /** Custom UI to display while session authentication is loading */
  loadingComponent?: React.ReactNode;
  /**
   * Optional React node or function to render when denied.
   * If a function is provided, it receives the refusal details.
   * If omitted, a Redirect component is rendered to redirect the user.
   */
  fallback?: React.ReactNode | ((refusal: RefusalReason) => React.ReactNode);
  /** Optional custom resolver to convert the raw session to a ParticipantBasis */
  resolveParticipant?: (session: any) => ParticipantBasis;
  /** Optional custom identity hierarchy list */
  hierarchy?: readonly IdentityBoundary[];
  /** Optional explicit participant basis to bypass default useSession check (useful for testing or nested context) */
  participant?: ParticipantBasis;
}

/**
 * Props for the PremiumReceiptBlockingScreen component.
 */
export interface PremiumReceiptBlockingScreenProps {
  commandId: string;
  expectedHash?: string;
  isChecking: boolean;
  refusalReason: RefusalReason | null;
  onRetry: () => void;
  onRedirect: () => void;
  redirectText?: string;
}

/**
 * Premium overlay blocking screen displaying cryptographic proof verification
 * statuses, metadata, signature badges, and detailed refusal reasons.
 */
export const PremiumReceiptBlockingScreen: React.FC<PremiumReceiptBlockingScreenProps> = ({
  commandId,
  expectedHash,
  isChecking,
  refusalReason,
  onRetry,
  onRedirect,
  redirectText = 'Return to Consequence Supervision',
}) => {
  return (
    <View className="flex-1 bg-slate-950 items-center justify-center p-6">
      {/* Background Ambient Glows */}
      <View className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -top-20 -left-20" />
      <View className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -bottom-20 -right-20" />

      <View className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {/* Header Indicator */}
        <View className="items-center mb-6">
          {isChecking ? (
            <View className="relative items-center justify-center w-20 h-20 mb-4">
              {/* Pulsing Outer Glow */}
              <View className="absolute inset-0 bg-violet-500/20 rounded-full animate-pulse border border-violet-500/30 scale-110" />
              {/* Spinner Container */}
              <View className="bg-slate-950 border border-indigo-500/80 rounded-full p-4 shadow-lg shadow-indigo-500/50 items-center justify-center w-16 h-16">
                <ActivityIndicator size="large" color="#8B5CF6" />
              </View>
            </View>
          ) : (
            <View className="relative items-center justify-center w-20 h-20 mb-4">
              {/* Failure Outer Glow */}
              <View className="absolute inset-0 bg-rose-500/10 rounded-full border border-rose-500/20 scale-110" />
              {/* Failure Icon */}
              <View className="bg-slate-950 border border-rose-500 rounded-full p-4 shadow-lg shadow-rose-500/30 items-center justify-center w-16 h-16">
                <FontAwesome name="exclamation-triangle" size={24} color="#F43F5E" />
              </View>
            </View>
          )}

          <Text className="text-xl font-bold text-slate-100 text-center tracking-tight">
            {isChecking ? 'Verifying Receipt' : 'Admission Refused'}
          </Text>
          <Text className="text-xs text-slate-400 mt-1 font-semibold tracking-wider uppercase text-center">
            {isChecking ? 'Cryptographic Proof Gating' : 'Security Clearance Blocked'}
          </Text>
        </View>

        {/* Metadata Section */}
        <View className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-5">
          {/* Badge row */}
          <View className="flex-row items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Proof Level
            </Text>
            {isChecking ? (
              <View className="bg-indigo-500/10 border border-indigo-500/30 rounded-full px-2.5 py-0.5 flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 animate-pulse" />
                <Text className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  BLAKE3 Verification
                </Text>
              </View>
            ) : refusalReason?.code === 'RECEIPT_HASH_MISMATCH' ? (
              <View className="bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                <Text className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Hash Mismatch
                </Text>
              </View>
            ) : (
              <View className="bg-rose-500/10 border border-rose-500/30 rounded-full px-2.5 py-0.5 flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
                <Text className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  Missing Proof
                </Text>
              </View>
            )}
          </View>

          {/* Command ID */}
          <View className="mb-3">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Command ID
            </Text>
            <View className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex-row items-center justify-between">
              <Text className="text-xs font-mono text-slate-300 flex-1 mr-2" numberOfLines={1}>
                {commandId}
              </Text>
              <FontAwesome name="lock" size={12} color="#64748B" />
            </View>
          </View>

          {/* Expected Hash */}
          {expectedHash ? (
            <View className="mb-3 border-t border-slate-800/40 pt-3">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Required Delta Hash
              </Text>
              <View className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <Text className="text-xs font-mono text-slate-400" numberOfLines={1}>
                  {expectedHash}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Signature Verification Badge */}
          <View className="flex-row items-center justify-between border-t border-slate-800/40 pt-3">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Signature Verification
            </Text>
            {isChecking ? (
              <View className="bg-indigo-950/60 border border-indigo-850 rounded-full px-2 py-0.5">
                <Text className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                  Checking...
                </Text>
              </View>
            ) : !refusalReason ? (
              <View className="bg-emerald-950/60 border border-emerald-800 rounded-full px-2 py-0.5">
                <Text className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                  Verified ✅
                </Text>
              </View>
            ) : (
              <View className="bg-rose-950/60 border border-rose-800 rounded-full px-2 py-0.5">
                <Text className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                  Unverified ❌
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Refusal reasons */}
        {!isChecking && refusalReason ? (
          <View className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-4 mb-5">
            <View className="flex-row items-center mb-1.5">
              <View className="mr-1.5">
                <FontAwesome name="shield" size={14} color="#F43F5E" />
              </View>
              <Text className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Refusal Reason ({refusalReason.code})
              </Text>
            </View>
            <Text className="text-xs text-rose-200/90 leading-relaxed font-medium">
              {refusalReason.message}
            </Text>
          </View>
        ) : null}

        {/* Interactive Buttons */}
        <View className="gap-2">
          {!isChecking ? (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.85}
              className="w-full bg-violet-600 active:bg-violet-700 py-3 rounded-xl items-center justify-center flex-row shadow-lg shadow-violet-500/25"
            >
              <View className="mr-2">
                <FontAwesome name="refresh" size={14} color="#FFFFFF" />
              </View>
              <Text className="text-white font-semibold text-sm tracking-wide">
                Retry Verification
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={onRedirect}
            activeOpacity={0.85}
            className="w-full bg-slate-800 active:bg-slate-700 py-3 rounded-xl items-center justify-center border border-slate-700/60"
          >
            <Text className="text-slate-200 font-semibold text-sm tracking-wide">
              {isChecking ? 'Cancel & Return' : redirectText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/**
 * Default resolver that maps a Supabase session structure to a ParticipantBasis.
 * Handles automatic extraction of email verification, metadata, etc.
 *
 * @param session The active Supabase session
 * @returns The resolved ParticipantBasis
 */
export function defaultResolveParticipant(session: any): ParticipantBasis {
  if (!session || !session.user) {
    return {
      identityBoundary: 'anonymous',
      disclosures: [],
    };
  }

  const disclosures: string[] = [];

  // 1. Extract common Supabase user attributes as automatic disclosures
  if (session.user.email_confirmed_at) {
    disclosures.push('email_verified');
  }
  if (session.user.phone_confirmed_at) {
    disclosures.push('phone_verified');
  }

  // 2. Check user metadata for explicit disclosures or flags
  const metadata = session.user.user_metadata || {};
  if (Array.isArray(metadata.disclosures)) {
    disclosures.push(...metadata.disclosures.map(String));
  }
  if (metadata.accepted_terms || metadata.acceptedTerms) {
    disclosures.push('terms_accepted');
  }

  // 3. Determine identity boundary level
  let identityBoundary: string = 'authenticated';
  if (session.user.email_confirmed_at || session.user.phone_confirmed_at) {
    identityBoundary = 'verified';
  }
  const hasActiveMFA = session.user.amr?.includes('mfa') || session.aal === 'aal2';
  if (hasActiveMFA) {
    identityBoundary = 'mfa_verified';
  }

  // Allow explicit metadata overrides
  if (typeof metadata.identity_boundary === 'string') {
    identityBoundary = metadata.identity_boundary;
  } else if (typeof metadata.identityBoundary === 'string') {
    identityBoundary = metadata.identityBoundary;
  }

  return {
    identityBoundary,
    disclosures,
  };
}

const AdmissionLoadingOverlay: React.FC = () => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={animatedStyle}>
        <ActivityIndicator size="large" color="#007AFF" />
      </Animated.View>
    </View>
  );
};

/**
 * ProtectedRoute component that gates access to child components.
 * Employs typestate checks on the participant identity and disclosures.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  route,
  children,
  redirectPath,
  loadingComponent,
  fallback,
  resolveParticipant = defaultResolveParticipant,
  hierarchy = DEFAULT_IDENTITY_HIERARCHY,
  participant,
}) => {
  const { session, loading, isTransitioning = false } = useSession();
  const router = useRouter();
  const latestReceipt = useActorOpsStore((state: any) => state.latestReceipt);
  const [receiptVerified, setReceiptVerified] = React.useState(false);
  const [checkingReceipt, setCheckingReceipt] = React.useState(!!route.requiredReceiptCommandId);
  const [refusalReason, setRefusalReason] = React.useState<RefusalReason | null>(null);

  const verifyReceipt = React.useCallback(
    async (active = true) => {
      if (!route.requiredReceiptCommandId) {
        if (active) {
          setReceiptVerified(true);
          setRefusalReason(null);
          setCheckingReceipt(false);
        }
        return;
      }

      if (active) {
        setCheckingReceipt(true);
      }

      const isSecurePath = !!route.requiredReceiptCommandId?.startsWith('cmd_');

      try {
        // 1. Check Zustand store's latestReceipt first (fast local check)
        if (latestReceipt && latestReceipt.commandId === route.requiredReceiptCommandId) {
          let isSigValid = true;
          if (isSecurePath) {
            const { signature, publicKey, ...unsignedReceipt } = latestReceipt;
            if (!signature || !publicKey) {
              isSigValid = false;
            } else {
              try {
                const messageHash = sha256(canonicalStringify(unsignedReceipt));
                const sigResult = verifyEcdsaSignature(messageHash, signature, publicKey);
                isSigValid = !!sigResult.valid;
              } catch (e) {
                isSigValid = false;
              }
            }
          }

          if (!isSigValid) {
            if (active) {
              setReceiptVerified(false);
              setRefusalReason({
                code: 'RECEIPT_SIGNATURE_INVALID',
                message: 'Receipt signature is invalid or unsigned.',
              });
              setCheckingReceipt(false);
            }
            return;
          }

          if (
            !route.requiredReceiptDeltaHash ||
            latestReceipt.deltaHash === route.requiredReceiptDeltaHash
          ) {
            if (active) {
              setReceiptVerified(true);
              setRefusalReason(null);
              setCheckingReceipt(false);
            }
            return;
          } else {
            if (active) {
              setReceiptVerified(false);
              setRefusalReason({
                code: 'RECEIPT_HASH_MISMATCH',
                message: `Receipt found in memory, but delta hash mismatch. Expected: ${route.requiredReceiptDeltaHash}, Actual: ${latestReceipt.deltaHash}`,
              });
              setCheckingReceipt(false);
            }
            return;
          }
        }

        // 2. Check MMKV (fast synchronous lookup)
        const mmkvReceiptJson = mmkvInstance.getString(`receipt_${route.requiredReceiptCommandId}`);
        const mmkvHash = mmkvInstance.getString(`receipt_hash_${route.requiredReceiptCommandId}`);

        let foundInMMKV = false;
        let mmkvHashMismatch = false;
        let mmkvSigInvalid = false;
        let actualHash = '';

        if (mmkvReceiptJson) {
          const receipt = JSON.parse(mmkvReceiptJson);
          actualHash = receipt.deltaHash;

          let isSigValid = true;
          if (isSecurePath) {
            const { signature, publicKey, ...unsignedReceipt } = receipt;
            if (!signature || !publicKey) {
              isSigValid = false;
            } else {
              try {
                const messageHash = sha256(canonicalStringify(unsignedReceipt));
                const sigResult = verifyEcdsaSignature(messageHash, signature, publicKey);
                isSigValid = !!sigResult.valid;
              } catch (e) {
                isSigValid = false;
              }
            }
          }

          if (!isSigValid) {
            mmkvSigInvalid = true;
          } else if (
            !route.requiredReceiptDeltaHash ||
            receipt.deltaHash === route.requiredReceiptDeltaHash
          ) {
            foundInMMKV = true;
          } else {
            mmkvHashMismatch = true;
          }
        } else if (mmkvHash) {
          actualHash = mmkvHash;
          if (isSecurePath) {
            mmkvSigInvalid = true;
          } else if (!route.requiredReceiptDeltaHash || mmkvHash === route.requiredReceiptDeltaHash) {
            foundInMMKV = true;
          } else {
            mmkvHashMismatch = true;
          }
        }

        if (mmkvSigInvalid) {
          if (active) {
            setReceiptVerified(false);
            setRefusalReason({
              code: 'RECEIPT_SIGNATURE_INVALID',
              message: 'Receipt signature is invalid or unsigned.',
            });
            setCheckingReceipt(false);
          }
          return;
        } else if (foundInMMKV) {
          if (active) {
            setReceiptVerified(true);
            setRefusalReason(null);
            setCheckingReceipt(false);
          }
          return;
        } else if (mmkvHashMismatch) {
          if (active) {
            setReceiptVerified(false);
            setRefusalReason({
              code: 'RECEIPT_HASH_MISMATCH',
              message: `Receipt found in local MMKV cache, but delta hash mismatch. Expected: ${route.requiredReceiptDeltaHash}, Actual: ${actualHash}`,
            });
            setCheckingReceipt(false);
          }
          return;
        }

        // 3. Check SQLite if not found in MMKV/Zustand
        const { db } = require('../lib/db/db');
        const { actorReceipts } = require('../lib/db/schema');
        const { eq } = require('drizzle-orm');

        const records = await db
          .select()
          .from(actorReceipts)
          .where(eq(actorReceipts.commandId, route.requiredReceiptCommandId));

        if (records.length > 0) {
          const record = records[0];

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
              if (active) {
                setReceiptVerified(false);
                setRefusalReason({
                  code: 'RECEIPT_SIGNATURE_INVALID',
                  message: 'Receipt signature is invalid or unsigned in SQLite storage.',
                });
              }
              return;
            }
          }

          if (route.requiredReceiptDeltaHash) {
            if (record.deltaHash === route.requiredReceiptDeltaHash) {
              if (active) {
                setReceiptVerified(true);
                setRefusalReason(null);
              }
            } else {
              if (active) {
                setReceiptVerified(false);
                setRefusalReason({
                  code: 'RECEIPT_HASH_MISMATCH',
                  message: `Receipt found in database, but delta hash mismatch. Expected: ${route.requiredReceiptDeltaHash}, Actual: ${record.deltaHash}`,
                });
              }
            }
          } else {
            if (active) {
              setReceiptVerified(true);
              setRefusalReason(null);
            }
          }
        } else {
          if (active) {
            setReceiptVerified(false);
            setRefusalReason({
              code: 'RECEIPT_NOT_FOUND',
              message: `Required BLAKE3 receipt for command '${route.requiredReceiptCommandId}' was not found in local storage (Zustand, MMKV, SQLite).`,
            });
          }
        }
      } catch (err: any) {
        if (active) {
          setReceiptVerified(false);
          setRefusalReason({
            code: 'RECEIPT_VERIFICATION_ERROR',
            message: `Verification process encountered an unexpected error: ${err?.message || String(err)}`,
          });
        }
      } finally {
        if (active) {
          setCheckingReceipt(false);
        }
      }
    },
    [route.requiredReceiptCommandId, route.requiredReceiptDeltaHash, latestReceipt]
  );

  React.useEffect(() => {
    let active = true;
    let mmkvListener: { remove: () => void } | null = null;

    verifyReceipt(active);

    // Subscribe to MMKV changes dynamically
    if (route.requiredReceiptCommandId) {
      try {
        mmkvListener = mmkvInstance.addOnValueChangedListener((key: string) => {
          if (
            key === `receipt_${route.requiredReceiptCommandId}` ||
            key === `receipt_hash_${route.requiredReceiptCommandId}`
          ) {
            verifyReceipt(active);
          }
        });
      } catch (err) {
        console.warn('Failed to subscribe to MMKV changes in ProtectedRoute:', err);
      }
    }

    return () => {
      active = false;
      if (mmkvListener) {
        mmkvListener.remove();
      }
    };
  }, [route.requiredReceiptCommandId, verifyReceipt]);

  // If loading or transitioning and no explicit participant is provided, render loading UI
  if ((loading || isTransitioning) && !participant) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return <AdmissionLoadingOverlay />;
  }

  // Resolve participant details (explicit override takes precedence)
  const activeParticipant = participant ?? resolveParticipant(session);

  // Evaluate admission constraints
  const { admitted, refusal } = admitRoute(activeParticipant, route, hierarchy);

  if (!admitted) {
    // Access denied: format refusal logic
    const activeRefusal: RefusalReason = refusal ?? {
      code: 'REFUSED',
      message: 'Access is restricted.',
    };

    // Render custom fallback if defined
    if (fallback) {
      if (typeof fallback === 'function') {
        return <>{fallback(activeRefusal)}</>;
      }
      return <>{fallback}</>;
    }

    // Otherwise, fallback to routing redirect
    const resolvedRedirectPath =
      redirectPath ?? (activeRefusal.code === 'UNAUTHENTICATED' ? '/(auth)' : '/');

    return <Redirect href={resolvedRedirectPath as any} />;
  }

  const resolvedRedirectPath = redirectPath ?? '/(tabs)';
  const handleRedirect = () => {
    router.replace(resolvedRedirectPath as any);
  };

  // If admitted but receipt check is in progress, show glowing spinner
  if (checkingReceipt) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <PremiumReceiptBlockingScreen
        commandId={route.requiredReceiptCommandId ?? ''}
        expectedHash={route.requiredReceiptDeltaHash}
        isChecking={true}
        refusalReason={null}
        onRetry={() => {
          verifyReceipt(true);
        }}
        onRedirect={handleRedirect}
        redirectText="Cancel & Return"
      />
    );
  }

  // If receipt verification failed, display the premium overlay blocking screen
  if (!receiptVerified) {
    const receiptRefusal: RefusalReason = refusalReason ?? {
      code: 'RECEIPT_NOT_FOUND',
      message: `Required BLAKE3 receipt for command '${route.requiredReceiptCommandId}' was not found in local storage.`,
    };

    if (fallback) {
      if (typeof fallback === 'function') {
        return <>{fallback(receiptRefusal)}</>;
      }
      return <>{fallback}</>;
    }

    return (
      <PremiumReceiptBlockingScreen
        commandId={route.requiredReceiptCommandId ?? ''}
        expectedHash={route.requiredReceiptDeltaHash}
        isChecking={false}
        refusalReason={receiptRefusal}
        onRetry={() => {
          verifyReceipt(true);
        }}
        onRedirect={handleRedirect}
        redirectText={redirectPath ? `Go to ${redirectPath}` : 'Return Home'}
      />
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
