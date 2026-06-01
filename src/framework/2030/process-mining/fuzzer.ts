/**
 * Log stream fuzzer for testing process mining deviations in Pcp 2030.
 * Generates various deviant traces from a standard valid trace.
 *
 * Ref: [conformance.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/conformance.test.ts)
 */

export function fuzzTraceSkip(trace: string[], transitionToSkip: string): string[] {
  return trace.filter((t) => t !== transitionToSkip);
}

export function fuzzTraceSwap(trace: string[], indexA: number, indexB: number): string[] {
  const fuzzed = [...trace];
  if (indexA >= 0 && indexA < fuzzed.length && indexB >= 0 && indexB < fuzzed.length) {
    const temp = fuzzed[indexA];
    fuzzed[indexA] = fuzzed[indexB];
    fuzzed[indexB] = temp;
  }
  return fuzzed;
}

export function fuzzTraceInsert(
  trace: string[],
  insertIndex: number,
  transitionToInsert: string
): string[] {
  const fuzzed = [...trace];
  if (insertIndex >= 0 && insertIndex <= fuzzed.length) {
    fuzzed.splice(insertIndex, 0, transitionToInsert);
  } else {
    fuzzed.push(transitionToInsert);
  }
  return fuzzed;
}

export function fuzzTraceDuplicate(trace: string[], transitionToDuplicate: string): string[] {
  const fuzzed: string[] = [];
  for (const t of trace) {
    fuzzed.push(t);
    if (t === transitionToDuplicate) {
      fuzzed.push(t);
    }
  }
  return fuzzed;
}

/**
 * Generates a suite of fuzzed deviant traces from a standard happy path trace.
 */
export function generateFuzzedDeviations(happyPath: string[]): Record<string, string[]> {
  return {
    skip_zkp_verification: fuzzTraceSkip(happyPath, 'T_VERIFY_ZKP'),
    out_of_order_intercept: fuzzTraceSwap(happyPath, 0, 1), // Swap T_VERIFY_ZKP and T_INTERCEPT
    duplicate_execution: fuzzTraceDuplicate(happyPath, 'T_EXECUTE'),
    unauthorized_transition_insertion: fuzzTraceInsert(happyPath, 3, 'T_UNAUTHORIZED_HACK'),
    bypassed_to_execution: ['T_EXECUTE', 'T_RESOLVE_SUCCESS'], // Extreme bypass
    unauthorized_then_crash: ['T_EXECUTE', 'T_RESOLVE_CRASH'],
  };
}
