export type CausalRefusal = 
  | "MissingSourceEvent"
  | "MissingTargetEvent"
  | "CycleDetected"
  | "TemporalInconsistency"
  | "DisconnectedComponent";

export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export interface CausalLink {
  sourceId: string;
  targetId: string;
  weight: number;
  label?: string;
  isStrongCausality: boolean; 
}

export interface CausalChain {
  chainId: string;
  links: CausalLink[];
  headIds: string[]; 
  tailIds: string[]; 
}

export interface CausalConsistencyVerdict {
  isConsistent: boolean;
  violations: string[]; 
}

export class CausalConsistency {
  private chain: CausalChain;

  constructor(chain: CausalChain) {
    this.chain = chain;
  }

  public validate(): Result<CausalConsistencyVerdict, CausalRefusal> {
    if (this.chain.links.length === 0) {
      return { 
        ok: true, 
        value: { isConsistent: true, violations: [] } 
      };
    }

    const violations: string[] = [];
    const graph = this.buildAdjacencyList();
    
    // Check for missing events in links
    for (const link of this.chain.links) {
      if (!link.sourceId) {
        return { ok: false, error: "MissingSourceEvent" };
      }
      if (!link.targetId) {
        return { ok: false, error: "MissingTargetEvent" };
      }
    }

    const cycleCheck = this.detectCycles(graph);
    
    if (!cycleCheck.ok) {
      if (cycleCheck.error === "CycleDetected") {
        violations.push("A causal cycle was detected in the chain.");
        return { 
          ok: true, 
          value: { isConsistent: false, violations } 
        };
      }
      return { ok: false, error: cycleCheck.error };
    }

    const reachabilityCheck = this.checkReachability(graph);
    if (!reachabilityCheck.ok) {
      return { ok: false, error: reachabilityCheck.error };
    }
    
    if (reachabilityCheck.value.unreachableNodes.length > 0) {
      violations.push(`Disconnected components detected: ${reachabilityCheck.value.unreachableNodes.join(", ")}`);
    }

    const isConsistent = violations.length === 0;

    return {
      ok: true,
      value: {
        isConsistent,
        violations
      }
    };
  }

  public evaluateSequence(sequence: string[]): Result<boolean, CausalRefusal> {
    if (sequence.length === 0) {
      return { ok: true, value: true };
    }

    const positions = new Map<string, number>();
    for (let i = 0; i < sequence.length; i++) {
        positions.set(sequence[i], i);
    }

    for (const link of this.chain.links) {
        if (link.isStrongCausality) {
            const posSource = positions.get(link.sourceId);
            const posTarget = positions.get(link.targetId);

            if (posSource !== undefined && posTarget !== undefined) {
                if (posSource >= posTarget) {
                    return { ok: false, error: "TemporalInconsistency" };
                }
            }
        }
    }

    return { ok: true, value: true };
  }

  private buildAdjacencyList(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const link of this.chain.links) {
      if (!graph.has(link.sourceId)) {
        graph.set(link.sourceId, []);
      }
      if (!graph.has(link.targetId)) {
        graph.set(link.targetId, []);
      }
      graph.get(link.sourceId)!.push(link.targetId);
    }
    return graph;
  }

  private detectCycles(graph: Map<string, string[]>): Result<null, CausalRefusal> {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const node of graph.keys()) {
      if (this.detectCycleUtil(node, graph, visited, recStack)) {
        return { ok: false, error: "CycleDetected" };
      }
    }

    return { ok: true, value: null };
  }

  private detectCycleUtil(
    node: string, 
    graph: Map<string, string[]>, 
    visited: Set<string>, 
    recStack: Set<string>
  ): boolean {
    if (recStack.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (this.detectCycleUtil(neighbor, graph, visited, recStack)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  private checkReachability(graph: Map<string, string[]>): Result<{ unreachableNodes: string[] }, CausalRefusal> {
    const visited = new Set<string>();
    const queue: string[] = [...this.chain.headIds];

    if (this.chain.links.length > 0 && this.chain.headIds.length === 0) {
        // Determine nodes with in-degree 0 if no heads are explicitly set
        const inDegree = new Map<string, number>();
        for (const node of graph.keys()) {
            inDegree.set(node, 0);
        }
        for (const [_, neighbors] of graph.entries()) {
            for (const neighbor of neighbors) {
                inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
            }
        }
        for (const [node, deg] of inDegree.entries()) {
            if (deg === 0) {
                queue.push(node);
            }
        }
        
        // If still no nodes to start, it means there are nodes but they all have in-degree > 0
        // Which means there's a cycle, which we already caught. If not caught, just start somewhere to avoid false disconnected component.
        if (queue.length === 0 && graph.size > 0) {
             const firstNode = Array.from(graph.keys())[0];
             if (firstNode) {
               queue.push(firstNode);
             }
        }
    }

    for (const head of queue) {
      visited.add(head);
    }

    let i = 0;
    while (i < queue.length) {
      const node = queue[i++];
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const unreachableNodes: string[] = [];
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        unreachableNodes.push(node);
      }
    }

    return { ok: true, value: { unreachableNodes } };
  }
}
