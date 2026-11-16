import { HookActorRef, HookBehavior, HookMessage, HookState, HookReplayProof } from './types';
import { runDelta } from './behavior';
import { sha256 } from './actorRef';
import { generateReceipt } from './receipts';

export async function proveReplay(
  ref: HookActorRef,
  initialState: HookState,
  messages: HookMessage[],
  expectedHistory: { messageId: string; outputHash: string; runId: string }[],
  behavior: HookBehavior
): Promise<HookReplayProof> {
  let state = { ...initialState };
  let currentChainHash = 'init_chain_hash';
  const effectsAccumulator: any[] = [];
  let verified = true;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const expected = expectedHistory[i];

    const ctx = {
      actorRef: ref,
      state: { ...state },
      timestamp: msg.timestamp ?? new Date().toISOString(),
    };

    const effects = await runDelta(behavior, msg, ctx);
    state = ctx.state;
    effectsAccumulator.push(...effects);

    const inputHash = sha256(JSON.stringify(msg.payload || {}));
    const outputHash = sha256(JSON.stringify(effects) + JSON.stringify(state));
    const deltaHash = sha256(JSON.stringify(effects));

    const tempReceipt = generateReceipt({
      tenantId: ref.tenantId,
      actorRef: ref,
      messageId: msg.id,
      previousReceiptHash: currentChainHash,
      inputHash,
      outputHash,
      deltaHash,
      status: 'Pending',
      hookRunId: expected ? expected.runId : 'run_replay',
    });

    currentChainHash = tempReceipt.receiptHash;

    if (expected) {
      if (outputHash !== expected.outputHash) {
        verified = false;
      }
    } else {
      verified = false;
    }
  }

  return {
    actorRef: ref,
    initialState,
    messages,
    finalState: state,
    effects: effectsAccumulator,
    receiptChainHash: currentChainHash,
    verified,
  };
}
