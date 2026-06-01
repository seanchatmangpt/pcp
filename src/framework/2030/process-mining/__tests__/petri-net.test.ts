import {
  PLACES,
  TRANSITIONS,
  W_MINUS,
  W_PLUS,
  formatLog,
  markingToVector,
  vectorToMarking,
  getIncidenceMatrix,
  computeStructuralStateEquation,
  createFiringVector,
  isTransitionEnabled,
  fireTransition,
  emitOcel2Log,
  parseOcel2Log,
  TokenReplayEngine,
  fuzzLogStream,
  Transition,
} from '../petri-net';

describe('Petri Net Model and Conformance Engine', () => {
  // Test 1: PLACES and TRANSITIONS schemas
  test('should define formal Petri Net places and transitions correctly', () => {
    expect(PLACES).toEqual(['Queue', 'Verifying', 'Attesting', 'Signing', 'Receipts', 'Verified']);
    expect(TRANSITIONS).toEqual(['enqueue', 'verifyZkp', 'signEnclave', 'signPq', 'bindReceipt']);
  });

  // Test 2: Structural Equations
  test('should calculate the incidence matrix C = WPlus - WMinus correctly', () => {
    const C = getIncidenceMatrix();
    // Dimensions should be PLACES.length (6) x TRANSITIONS.length (5)
    expect(C.length).toBe(6);
    expect(C[0].length).toBe(5);

    // Queue index 0, enqueue transition index 0
    // C[0][0] = WPlus['Queue']['enqueue'] - WMinus['Queue']['enqueue'] = 1 - 0 = 1
    expect(C[0][0]).toBe(1);

    // Queue index 0, verifyZkp transition index 1
    // C[0][1] = WPlus['Queue']['verifyZkp'] - WMinus['Queue']['verifyZkp'] = 0 - 1 = -1
    expect(C[0][1]).toBe(-1);

    // Signing index 3, bindReceipt transition index 4
    // C[3][4] = WPlus['Signing']['bindReceipt'] - WMinus['Signing']['bindReceipt'] = 0 - 2 = -2
    expect(C[3][4]).toBe(-2);
  });

  test('should convert between markings and vectors correctly', () => {
    const marking = {
      Queue: 1,
      Verifying: 2,
      Attesting: 3,
      Signing: 4,
      Receipts: 5,
      Verified: 6,
    };
    const vector = markingToVector(marking);
    expect(vector).toEqual([1, 2, 3, 4, 5, 6]);

    const reconstructed = vectorToMarking(vector);
    expect(reconstructed).toEqual(marking);
  });

  test('should update states using structural equation M_k = M_{k-1} + C * x_k', () => {
    const initialVector = [0, 0, 0, 0, 0, 0]; // Empty net
    const enqueueFiring = createFiringVector('enqueue'); // [1, 0, 0, 0, 0]

    const nextVector = computeStructuralStateEquation(initialVector, enqueueFiring);
    expect(nextVector).toEqual([1, 0, 0, 0, 0, 0]); // 1 token in Queue

    const verifyFiring = createFiringVector('verifyZkp'); // [0, 1, 0, 0, 0]
    const stateAfterVerify = computeStructuralStateEquation(nextVector, verifyFiring);
    expect(stateAfterVerify).toEqual([0, 1, 1, 0, 0, 0]); // 1 in Verifying, 1 in Attesting
  });

  // Test 3: Simulation and enabling rules
  test('should correctly check if a transition is enabled and fire it', () => {
    let marking = {
      Queue: 0,
      Verifying: 0,
      Attesting: 0,
      Signing: 0,
      Receipts: 0,
      Verified: 0,
    };

    expect(isTransitionEnabled(marking, 'verifyZkp')).toBe(false);

    // After enqueuing
    marking.Queue = 1;
    expect(isTransitionEnabled(marking, 'verifyZkp')).toBe(true);

    // Fire verifyZkp
    marking = fireTransition(marking, 'verifyZkp');
    expect(marking).toEqual({
      Queue: 0,
      Verifying: 1,
      Attesting: 1,
      Signing: 0,
      Receipts: 0,
      Verified: 0,
    });

    expect(isTransitionEnabled(marking, 'signEnclave')).toBe(true);
    expect(isTransitionEnabled(marking, 'signPq')).toBe(true);
    expect(isTransitionEnabled(marking, 'bindReceipt')).toBe(false);

    // Fire signEnclave
    marking = fireTransition(marking, 'signEnclave');
    expect(marking.Signing).toBe(1);
    expect(marking.Verifying).toBe(0);

    // Still cannot fire bindReceipt (requires weight 2)
    expect(isTransitionEnabled(marking, 'bindReceipt')).toBe(false);

    // Fire signPq
    marking = fireTransition(marking, 'signPq');
    expect(marking.Signing).toBe(2);
    expect(marking.Attesting).toBe(0);

    // Now enabled!
    expect(isTransitionEnabled(marking, 'bindReceipt')).toBe(true);

    marking = fireTransition(marking, 'bindReceipt');
    expect(marking).toEqual({
      Queue: 0,
      Verifying: 0,
      Attesting: 0,
      Signing: 0,
      Receipts: 1,
      Verified: 1,
    });
  });

  test('should throw error when firing a disabled transition in simulation', () => {
    const emptyMarking = {
      Queue: 0,
      Verifying: 0,
      Attesting: 0,
      Signing: 0,
      Receipts: 0,
      Verified: 0,
    };
    expect(() => fireTransition(emptyMarking, 'verifyZkp')).toThrow();
  });

  // Test 4: OCEL 2.0 Compliance (Emit and Parse)
  test('should emit and parse OCEL 2.0 logs representing execution', () => {
    const events = [
      {
        eid: 'e1',
        activity: 'enqueue' as Transition,
        timestamp: '2026-06-01T03:00:00Z',
        omap: ['t1', 'a1'],
      },
      {
        eid: 'e2',
        activity: 'verifyZkp' as Transition,
        timestamp: '2026-06-01T03:00:10Z',
        omap: ['t1', 'a1'],
      },
    ];
    const objects = [
      { oid: 't1', type: 'Token', vmap: { owner: 'user1' } },
      { oid: 'a1', type: 'Agent', vmap: { version: '1.0' } },
    ];

    const log = emitOcel2Log(events, objects);
    expect(log['ocel:global-log']['ocel:version']).toBe('2.0');
    expect(log['ocel:events']['e1']['ocel:activity']).toBe('enqueue');
    expect(log['ocel:objects']['t1']['ocel:type']).toBe('Token');

    const jsonString = JSON.stringify(log);
    const parsedLog = parseOcel2Log(jsonString);
    expect(parsedLog['ocel:events']['e2']['ocel:activity']).toBe('verifyZkp');
  });

  test('should throw error when parsing OCEL log with invalid version', () => {
    const badLog = {
      'ocel:global-log': {
        'ocel:version': '1.0',
        'ocel:ordering': 'timestamp',
        'ocel:object-types': [],
      },
      'ocel:events': {},
      'ocel:objects': {},
    };
    expect(() => parseOcel2Log(JSON.stringify(badLog))).toThrow(
      /Invalid OCEL log: expected version 2.0/
    );
  });

  // Test 5: Token Game Replay Conformance Checker
  test('should check conformance of a valid sequential trace', () => {
    const engine = new TokenReplayEngine();
    const result = engine.replayTrace([
      'enqueue',
      'verifyZkp',
      'signEnclave',
      'signPq',
      'bindReceipt',
    ]);

    expect(result.isConforming).toBe(true);
    expect(result.fitness).toBe(1.0);
    expect(result.missing).toBe(0);
    expect(result.remaining).toBe(0);
  });

  test('should detect deviations in invalid traces', () => {
    const engine = new TokenReplayEngine();

    // 1. Missing enqueue
    const res1 = engine.replayTrace(['verifyZkp', 'signEnclave', 'signPq', 'bindReceipt']);
    expect(res1.isConforming).toBe(false);
    expect(res1.fitness).toBeLessThan(1.0);
    expect(res1.missing).toBeGreaterThan(0);

    // 2. Missing PQ signature (forces bindReceipt to run with 1 token in Signing, which needs 2)
    const res2 = engine.replayTrace(['enqueue', 'verifyZkp', 'signEnclave', 'bindReceipt']);
    expect(res2.isConforming).toBe(false);
    expect(res2.fitness).toBeLessThan(1.0);
    // There will be a remaining token in Attesting because signPq was never fired
    expect(res2.remaining).toBe(1);
    // There will be a missing token in Signing during bindReceipt
    expect(res2.missing).toBe(1);
  });

  // Test 6: Fuzz testing
  test('should fuzz test log streams and check deviations using the engine', () => {
    const strategies: Array<
      | 'valid'
      | 'missing_enqueue'
      | 'missing_verify_zkp'
      | 'missing_sign_enclave'
      | 'missing_sign_pq'
      | 'missing_bind_receipt'
      | 'duplicate_step'
      | 'out_of_order'
    > = [
      'valid',
      'missing_enqueue',
      'missing_verify_zkp',
      'missing_sign_enclave',
      'missing_sign_pq',
      'missing_bind_receipt',
      'duplicate_step',
      'out_of_order',
    ];

    const engine = new TokenReplayEngine();

    for (const strategy of strategies) {
      const fuzzedLog = fuzzLogStream({ strategy, tokenId: 'token-123', agentId: 'agent-456' });
      const result = engine.replayOcelObject(fuzzedLog, 'token-123');

      if (strategy === 'valid') {
        expect(result.isConforming).toBe(true);
        expect(result.fitness).toBe(1.0);
      } else {
        expect(result.isConforming).toBe(false);
        expect(result.fitness).toBeLessThan(1.0);
      }
    }
  });

  // Test 7: Absolute Markdown Links Verification in logs
  test('should ensure absolute markdown links in all emitted conformance logs', () => {
    const engine = new TokenReplayEngine();
    const result = engine.replayTrace(['verifyZkp']); // highly non-conforming trace

    expect(result.logs.length).toBeGreaterThan(0);
    const expectedLink =
      '[petri-net.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/petri-net.ts)';
    for (const log of result.logs) {
      expect(log).toContain(expectedLink);
    }

    const formatted = formatLog('Test message');
    expect(formatted).toContain(expectedLink);
  });
});
