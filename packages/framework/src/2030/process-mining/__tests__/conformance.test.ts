import {
  AGENT_NATIVE_PETRI_NET as CONFORMANCE_PETRI_NET,
  AGENT_NATIVE_INITIAL_MARKING as CONFORMANCE_INITIAL_MARKING,
  AGENT_NATIVE_FINAL_PLACES as CONFORMANCE_FINAL_PLACES,
  replayTrace as conformanceReplayTrace,
  Ocel2LogBuilder,
  parseOcel2Log,
  fuzzTrace,
  fuzzOcelLog,
} from '../conformance';

import {
  AGENT_NATIVE_PETRI_NET as SAFETY_PETRI_NET,
  PetriNetReplayer,
  TemporalSafetyChecker,
  LogFuzzer,
  OCEL2Serializer,
  ReplayMarking,
} from '../safety-constraints';

// Define structural interfaces to validate Petri Nets
interface PetriNetPlace {
  id: string;
  label?: string;
  name?: string;
}

interface PetriNetTransition {
  id: string;
  label?: string;
  name?: string;
}

interface PetriNetArc {
  source: string;
  target: string;
  weight?: number;
}

interface PetriNetSchema {
  places: PetriNetPlace[];
  transitions: PetriNetTransition[];
  arcs: PetriNetArc[];
}

/**
 * Validates the structural integrity and bipartiteness of a Petri Net.
 * Ensures there are no Place-to-Place or Transition-to-Transition connections.
 * Ensures all sources and targets exist and are uniquely identified.
 *
 * Ref: [conformance.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/conformance.test.ts)
 */
function validatePetriNetStructure(net: PetriNetSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const placeIds = new Set(net.places.map((p) => p.id));
  const transitionIds = new Set(net.transitions.map((t) => t.id));

  // Check unique IDs
  if (placeIds.size !== net.places.length) {
    errors.push('Duplicate place IDs detected.');
  }
  if (transitionIds.size !== net.transitions.length) {
    errors.push('Duplicate transition IDs detected.');
  }

  // Check bipartiteness and existence of source/target
  for (let i = 0; i < net.arcs.length; i++) {
    const arc = net.arcs[i];
    const sourceIsPlace = placeIds.has(arc.source);
    const sourceIsTransition = transitionIds.has(arc.source);
    const targetIsPlace = placeIds.has(arc.target);
    const targetIsTransition = transitionIds.has(arc.target);

    if (!sourceIsPlace && !sourceIsTransition) {
      errors.push(`Arc index ${i} source '${arc.source}' does not exist.`);
    }
    if (!targetIsPlace && !targetIsTransition) {
      errors.push(`Arc index ${i} target '${arc.target}' does not exist.`);
    }
    if (sourceIsPlace && targetIsPlace) {
      errors.push(
        `Arc index ${i} connects Place '${arc.source}' directly to Place '${arc.target}', violating bipartiteness.`
      );
    }
    if (sourceIsTransition && targetIsTransition) {
      errors.push(
        `Arc index ${i} connects Transition '${arc.source}' directly to Transition '${arc.target}', violating bipartiteness.`
      );
    }
    if (arc.weight !== undefined && arc.weight <= 0) {
      errors.push(`Arc index ${i} weight must be positive, got ${arc.weight}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Pcp 2030 Process Mining Conformance and Safety Suite', () => {
  describe('1. Petri Net Schema Structure and Validation', () => {
    it('should successfully validate the CONFORMANCE_PETRI_NET structure', () => {
      const result = validatePetriNetStructure(CONFORMANCE_PETRI_NET);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should successfully validate the SAFETY_PETRI_NET structure', () => {
      const result = validatePetriNetStructure(SAFETY_PETRI_NET);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch bipartiteness violation (Place-to-Place connection)', () => {
      const malformedNet: PetriNetSchema = {
        places: [{ id: 'p_1' }, { id: 'p_2' }],
        transitions: [{ id: 't_1' }],
        arcs: [{ source: 'p_1', target: 'p_2' }], // Place to Place
      };
      const result = validatePetriNetStructure(malformedNet);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('violating bipartiteness'))).toBe(true);
    });
  });
});
