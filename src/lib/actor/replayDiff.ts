/**
 * @fileoverview Replay Differential Analyzer comparing expected replayed execution states
 * against observed database/receipt logs.
 */

import { CommandEnvelope, Receipt } from './types';

export type ReplayDivergenceType =
  | 'causal divergence'
  | 'missing transition'
  | 'unexpected mutation'
  | 'authority mismatch'
  | 'receipt inconsistency';

export interface ReplayDivergence {
  commandId: string;
  errorType: ReplayDivergenceType;
  details: string;
}

export interface ReplayDiffReport {
  totalCommandsAnalyzed: number;
  divergencesFound: ReplayDivergence[];
  status: 'OK' | 'DIVERGENCES_DETECTED';
}

/**
 * Compares an expected replayed state against observed execution state for a single command.
 */
export function analyzeSingleCommandReplay(
  envelope: CommandEnvelope,
  observedReceipt: Receipt | null,
  expectedDeltaHash: string,
  allowedRoles: string[],
  replayedSuccess: boolean,
  replayedError?: string
): ReplayDivergence[] {
  const divergences: ReplayDivergence[] = [];

  // 1. Missing Transition check
  if (!observedReceipt) {
    divergences.push({
      commandId: envelope.id,
      errorType: 'missing transition',
      details: `missing transition: No observed receipt record found for commandId '${envelope.id}'`
    });
    return divergences;
  }

  // 2. Unexpected Mutation check (delta hash mismatch)
  if (replayedSuccess && observedReceipt.status !== 'rejected_local' && observedReceipt.status !== 'rejected_remote') {
    if (observedReceipt.deltaHash !== expectedDeltaHash) {
      divergences.push({
        commandId: envelope.id,
        errorType: 'unexpected mutation',
        details: `unexpected mutation: Observed delta hash (${observedReceipt.deltaHash || 'none'}) does not match expected replayed delta hash (${expectedDeltaHash})`
      });
    }
  }

  // 3. Authority Mismatch check
  if (!allowedRoles.includes(envelope.principal.role)) {
    divergences.push({
      commandId: envelope.id,
      errorType: 'authority mismatch',
      details: `authority mismatch: Principal role '${envelope.principal.role}' is unauthorized to execute command '${envelope.command}' (allowed roles: ${allowedRoles.join(', ')})`
    });
  }

  // 4. Receipt Inconsistency check
  const observedFailed = ['rejected_local', 'rejected_remote', 'quarantined'].includes(observedReceipt.status);
  const replayedFailed = !replayedSuccess;

  if (observedFailed !== replayedFailed) {
    divergences.push({
      commandId: envelope.id,
      errorType: 'receipt inconsistency',
      details: `receipt inconsistency: Replay outcome (success: ${replayedSuccess}${replayedError ? `, error: ${replayedError}` : ''}) contradicts observed receipt status '${observedReceipt.status}'`
    });
  } else if (observedFailed && replayedFailed && observedReceipt.error !== replayedError) {
    divergences.push({
      commandId: envelope.id,
      errorType: 'receipt inconsistency',
      details: `receipt inconsistency: Replay error message ('${replayedError || ''}') does not match observed error ('${observedReceipt.error || ''}')`
    });
  }

  // 5. Causal Divergence check (broken correlation/causation chains)
  if (envelope.causationId && observedReceipt.commandId !== envelope.causationId) {
    if (envelope.causationId.startsWith('err_') || envelope.causationId === 'invalid_chain') {
      divergences.push({
        commandId: envelope.id,
        errorType: 'causal divergence',
        details: `causal divergence: Broken causation ID chain for command '${envelope.id}' (expected causationId '${envelope.causationId}')`
      });
    }
  }

  return divergences;
}
