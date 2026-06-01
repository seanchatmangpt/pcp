import { sha256, canonicalStringify } from '../crypto/receipts';

export class ReplayEvaluator {
  /**
   * Replays a list of inputs over a clean state using the dispatch block,
   * returning the canonical state hash of the converged end state.
   */
  static async replay<S, I>(
    inputs: I[],
    initialState: S,
    dispatchBlock: (state: S, input: I) => Promise<S>
  ): Promise<{ finalState: S; canonicalHash: string }> {
    let state = JSON.parse(JSON.stringify(initialState));

    for (const input of inputs) {
      state = await dispatchBlock(state, input);
    }

    const canonicalHash = sha256(canonicalStringify(state));

    return {
      finalState: state,
      canonicalHash
    };
  }
}
