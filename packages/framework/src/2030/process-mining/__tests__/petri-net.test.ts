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
});
