/**
 * @fileoverview Process Mining and Conformance Checking for Agent Native Interface.
 * Implements the Dr. Wil van der Aalst AGI doctrine for Pcp Agent.
 * See architectural details in [agent-native.md](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md).
 */

export interface PetriNetPlace {
  id: string;
  label: string;
}

export interface PetriNetTransition {
  id: string;
  label: string;
  inputs: string[];
  outputs: string[];
}

export interface AgentNativePetriNet {
  places: Record<string, PetriNetPlace>;
  transitions: Record<string, PetriNetTransition>;
}

/**
 * Formal Petri Net transition schema for Agent native operations.
 * Governs the chronological state flow of command execution.
 */
export const AGENT_NATIVE_PETRI_NET_SCHEMA: AgentNativePetriNet = {
  places: {
    p_received: { id: 'p_received', label: 'Command Received' },
    p_enqueued: { id: 'p_enqueued', label: 'Command Enqueued' },
    p_verified: { id: 'p_verified', label: 'ZKP Verified' },
    p_attestation_checked: { id: 'p_attestation_checked', label: 'Attestation Checked' },
    p_receipt_bound: { id: 'p_receipt_bound', label: 'Receipt Bound' },
  },
  transitions: {
    t_enqueue: {
      id: 't_enqueue',
      label: 'Enqueue Command',
      inputs: ['p_received'],
      outputs: ['p_enqueued'],
    },
    t_verify: {
      id: 't_verify',
      label: 'Verify ZKP',
      inputs: ['p_enqueued'],
      outputs: ['p_verified'],
    },
    t_attest: {
      id: 't_attest',
      label: 'Check Attestation',
      inputs: ['p_verified'],
      outputs: ['p_attestation_checked'],
    },
    t_bind: {
      id: 't_bind',
      label: 'Bind Receipt',
      inputs: ['p_attestation_checked'],
      outputs: ['p_receipt_bound'],
    },
  },
};

export interface AgentNativeOcel2Object {
  id: string;
  type: string;
  attributes: Record<string, any>;
}

export interface AgentNativeOcel2Event {
  id: string;
  activity: string;
  timestamp: string;
  omap: string[]; // Related object IDs
  vmap: Record<string, any>; // Event values/attributes
}

export interface AgentNativeOcel2Log {
  objects: AgentNativeOcel2Object[];
  events: AgentNativeOcel2Event[];
}

/**
 * Log generator for emitting OCEL 2.0 compliant execution logs.
 */
export class LogGenerator {
  private events: AgentNativeOcel2Event[] = [];
  private objects: Map<string, AgentNativeOcel2Object> = new Map();

  /**
   * Adds or updates an object in the OCEL object store.
   */
  public addObject(id: string, type: string, attributes: Record<string, any> = {}): void {
    const existing = this.objects.get(id);
    if (existing) {
      this.objects.set(id, {
        id,
        type,
        attributes: { ...existing.attributes, ...attributes },
      });
    } else {
      this.objects.set(id, { id, type, attributes });
    }
  }

  /**
   * Emits an event to the OCEL event log.
   */
  public addEvent(activity: string, omap: string[], vmap: Record<string, any> = {}): void {
    const id = `evt-${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();
    this.events.push({
      id,
      activity,
      timestamp,
      omap,
      vmap,
    });
  }

  /**
   * Retreives the generated OCEL 2.0 log.
   */
  public getLog(): AgentNativeOcel2Log {
    return {
      objects: Array.from(this.objects.values()),
      events: [...this.events],
    };
  }

  /**
   * Clears the log generator memory.
   */
  public clear(): void {
    this.events = [];
    this.objects.clear();
  }
}

export interface ConformanceResult {
  fitness: number;
  isConforming: boolean;
  missingTokens: number;
  producedTokens: number;
  consumedTokens: number;
  remainingTokens: number;
  deviations: string[];
}

/**
 * Token-game replay conformance checker to audit Agent execution paths.
 * Replays activities step-by-step using token logistics on the Petri Net.
 */
export class TokenReplayConformanceChecker {
  /**
   * Replays an OCEL event trace for a single command on the Agent Native Petri Net.
   */
  public checkTrace(events: AgentNativeOcel2Event[]): ConformanceResult {
    const markings: Record<string, number> = {
      p_received: 0,
      p_enqueued: 0,
      p_verified: 0,
      p_attestation_checked: 0,
      p_receipt_bound: 0,
    };

    let produced = 0;
    let consumed = 0;
    let missing = 0;
    const deviations: string[] = [];

    const produceToken = (place: string) => {
      markings[place] = (markings[place] || 0) + 1;
      produced++;
    };

    const consumeToken = (place: string) => {
      consumed++;
      if (!markings[place] || markings[place] <= 0) {
        missing++;
        markings[place] = 1; // force token presence for replay continuity
        deviations.push(
          `[TokenReplay] Missing token at place ${place} during transition execution. Link reference: [interface.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/interface.ts)`
        );
      }
      markings[place]--;
    };

    // Initial marking: 1 token in p_received
    produceToken('p_received');

    // Petri Net activity mappings
    const activityTransitionMap: Record<string, { inputs: string[]; outputs: string[] }> = {
      EnqueueCommand: { inputs: ['p_received'], outputs: ['p_enqueued'] },
      VerifyZkp: { inputs: ['p_enqueued'], outputs: ['p_verified'] },
      CheckAttestation: { inputs: ['p_verified'], outputs: ['p_attestation_checked'] },
      BindReceipt: { inputs: ['p_attestation_checked'], outputs: ['p_receipt_bound'] },
    };

    for (const event of events) {
      const trans = activityTransitionMap[event.activity];
      if (!trans) {
        deviations.push(
          `[TokenReplay] Undeclared activity found in event log: ${event.activity}. Link reference: [process-mining.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/process-mining.ts)`
        );
        missing++; // Treat as missing token/conformance penalty to lower fitness
        continue;
      }

      // Fire transition: consume inputs, produce outputs
      for (const input of trans.inputs) {
        consumeToken(input);
      }
      for (const output of trans.outputs) {
        produceToken(output);
      }
    }

    // Final marking consumption: consume 1 token from p_receipt_bound
    consumeToken('p_receipt_bound');

    // Count remaining tokens
    let remaining = 0;
    for (const place in markings) {
      if (markings[place] > 0) {
        remaining += markings[place];
        deviations.push(
          `[TokenReplay] Remaining token left in place ${place} after trace execution. Link reference: [interface.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/interface.ts)`
        );
      }
    }

    // Calculate fitness using Van der Aalst metric
    // fitness = 0.5 * (1 - m/c) + 0.5 * (1 - r/p)
    const fitness = 0.5 * (1 - missing / consumed) + 0.5 * (1 - remaining / produced);

    return {
      fitness: Math.max(0, Math.min(1, fitness)),
      isConforming: deviations.length === 0,
      missingTokens: missing,
      producedTokens: produced,
      consumedTokens: consumed,
      remainingTokens: remaining,
      deviations,
    };
  }
}
