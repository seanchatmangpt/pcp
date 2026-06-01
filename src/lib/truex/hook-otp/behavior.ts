import { HookBehavior, HookMessage, HookExecutionContext, HookEffect, ReplayResult, HookState } from './types';

export async function runInit(behavior: HookBehavior): Promise<HookState> {
  if (behavior.init) {
    return behavior.init();
  }
  return {};
}

export async function runDelta(
  behavior: HookBehavior,
  msg: HookMessage,
  ctx: HookExecutionContext
): Promise<HookEffect[]> {
  if (behavior.handleDelta) {
    return behavior.handleDelta(msg, ctx);
  }
  return [];
}

export async function runReceipt(
  behavior: HookBehavior,
  msg: HookMessage,
  ctx: HookExecutionContext
): Promise<void> {
  if (behavior.handleReceipt) {
    await behavior.handleReceipt(msg, ctx);
  }
}

export async function runReplay(
  behavior: HookBehavior,
  msg: HookMessage,
  ctx: HookExecutionContext
): Promise<ReplayResult> {
  if (behavior.handleReplay) {
    return behavior.handleReplay(msg, ctx);
  }
  // Default fallback replay execution: execute handleDelta and return its results
  try {
    const effects = await runDelta(behavior, msg, ctx);
    return {
      success: true,
      outputHash: 'hash_' + JSON.stringify(effects) + '_' + JSON.stringify(ctx.state),
      state: ctx.state,
      effects
    };
  } catch (err: any) {
    return {
      success: false,
      outputHash: 'error_hash',
      state: ctx.state,
      effects: [],
      error: err.message || String(err)
    };
  }
}

export async function runTerminate(
  behavior: HookBehavior,
  reason: string,
  ctx: HookExecutionContext
): Promise<void> {
  if (behavior.terminate) {
    await behavior.terminate(reason, ctx);
  }
}
