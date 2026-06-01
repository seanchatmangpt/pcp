import { analyzeSingleCommandReplay } from '../replayDiff';
import { CommandEnvelope, Receipt } from '../types';

describe('Replay Differential Analysis Subsystem', () => {
  const envelope: CommandEnvelope = {
    id: 'cmd-1',
    actor: { tenantId: 't1', kind: 'Sermon', id: 's1' },
    command: 'PublishSermon',
    principal: { id: 'u1', role: 'admin' },
    payload: { title: 'Grace' },
    idempotencyKey: 'idemp-1'
  };

  const allowedRoles = ['admin', 'pastor'];

  it('detects missing transitions when observed receipt is null', () => {
    const res = analyzeSingleCommandReplay(
      envelope,
      null,
      'hash_123',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('missing transition');
    expect(res[0].details).toContain('missing transition');
  });

  it('detects unexpected mutations when delta hashes mismatch', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_different',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_expected',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('unexpected mutation');
    expect(res[0].details).toContain('unexpected mutation');
  });

  it('detects unexpected mutations when observed delta hash is missing/none', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'applied_remote',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_expected',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('unexpected mutation');
    expect(res[0].details).toContain('Observed delta hash (none) does not match expected replayed delta hash');
  });

  it('detects authority mismatch when role execution differs from spec', () => {
    const envelopeMember = { ...envelope, principal: { id: 'u2', role: 'member' as any } };
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelopeMember,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('authority mismatch');
    expect(res[0].details).toContain('authority mismatch');
  });

  it('detects receipt inconsistency on replayed vs observed status/error mismatches', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'applied_remote', // Indicates success
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    // Replay failed but observed succeeded
    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      false, // replayedSuccess is false
      'ValidationError: Invalid Title'
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('receipt inconsistency');
    expect(res[0].details).toContain('receipt inconsistency');
  });

  it('detects receipt inconsistency when replay outcome contradicts status without replayedError', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      false, // replayedSuccess is false
      undefined // no replayedError
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('receipt inconsistency');
    expect(res[0].details).toContain("Replay outcome (success: false) contradicts observed receipt status 'applied_remote'");
  });

  it('detects receipt inconsistency when both fail but error messages mismatch', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'rejected_remote', // Indicates failure
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString(),
      error: 'ValidationError: Observed error message'
    };

    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      false, // replayedSuccess is false
      'ValidationError: Replayed error message'
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('receipt inconsistency');
    expect(res[0].details).toContain("Replay error message ('ValidationError: Replayed error message') does not match observed error ('ValidationError: Observed error message')");
  });

  it('detects no receipt inconsistency when both fail with identical error messages', () => {
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-1',
      actor: envelope.actor,
      status: 'rejected_remote', // Indicates failure
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString(),
      error: 'ValidationError: Identical error'
    };

    const res = analyzeSingleCommandReplay(
      envelope,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      false, // replayedSuccess is false
      'ValidationError: Identical error'
    );
    const receiptInconsistency = res.filter(r => r.errorType === 'receipt inconsistency');
    expect(receiptInconsistency).toHaveLength(0);
  });

  it('detects causal divergence when correlation chains are broken (invalid_chain)', () => {
    const envelopeCausal = { ...envelope, causationId: 'invalid_chain' };
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-different', // Doesn't match causationId
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelopeCausal,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('causal divergence');
    expect(res[0].details).toContain('causal divergence');
  });

  it('detects causal divergence when causation ID starts with err_', () => {
    const envelopeCausal = { ...envelope, causationId: 'err_db_deadlock' };
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-different',
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelopeCausal,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      true
    );
    expect(res).toHaveLength(1);
    expect(res[0].errorType).toBe('causal divergence');
    expect(res[0].details).toContain("Broken causation ID chain for command 'cmd-1' (expected causationId 'err_db_deadlock')");
  });

  it('ignores causal checks when causation ID does not start with err_ and is not invalid_chain', () => {
    const envelopeCausal = { ...envelope, causationId: 'cmd-legit-parent' };
    const observedReceipt: Receipt = {
      id: 'rec-1',
      commandId: 'cmd-different',
      actor: envelope.actor,
      status: 'applied_remote',
      deltaHash: 'hash_ok',
      eventIds: [],
      createdAt: new Date().toISOString()
    };

    const res = analyzeSingleCommandReplay(
      envelopeCausal,
      observedReceipt,
      'hash_ok',
      allowedRoles,
      true
    );
    const causalDivergences = res.filter(r => r.errorType === 'causal divergence');
    expect(causalDivergences).toHaveLength(0);
  });
});
