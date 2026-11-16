# Agent-Native Framework: The 2030 Interface

The Pcp Framework's `src/framework/2030/agent-native` module represents a paradigm shift in how software interacts with intelligence. In the 2030 vision, AI agents are not merely consumers of APIs; they are primary citizens that interact with the system through a secure, semantic, and governed interface known as the **Operational Membrane**.

## 1. Module Overview: `agent-native`

The `agent-native` module provides the core primitives for building "Agent-First" applications. It abstracts the complexity of authorization, state management, and command execution into a single, unified interface.

- **`AgentNativeInterface`**: The primary gateway for agents. It handles state inspection and semantic command dispatching.
- **`SemanticCommand`**: A structured intent from an agent, decoupling the _what_ (intent) from the _how_ (implementation).
- **`StateInspectionRequest`**: A secure way for agents to query the application's current state with cryptographic proof of authorization.

## 2. "Agent-First" Design & The Operational Membrane

### Philosophy

Traditional API design focuses on human-readable endpoints or machine-to-machine REST/GraphQL contracts. **Agent-First design** assumes the primary caller is an LLM or an autonomous agent. Instead of navigating hundreds of endpoints, agents interact via:

1.  **Semantic Intent**: High-level actions (e.g., "rebalance_portfolio") rather than low-level state mutations.
2.  **State Transparency**: A queryable JSON-path based state tree that allows agents to understand context without manual data fetching.

### The Operational Membrane

Every interaction between an agent and the Pcp Framework is mediated by the **Operational Membrane** (`src/framework/membrane`). The membrane acts as a "Zero-Trust" boundary that:

- **Evaluates Admissibility**: Interceptors check if the command is valid in the current application context.
- **Enforces Trajectories**: Validates that state transitions follow the predefined ontology (e.g., you cannot move from `DRAFT` to `PUBLISHED` without an intermediate `REVIEW` state).
- **Emits Receipts**: Every action generates a cryptographic receipt (`MembraneReceipt`) that serves as an immutable audit trail.

## 3. Secure Dispatching & ZKP Verification

Security in an Agent-Native world cannot rely on static API keys or bearer tokens, which are easily leaked. Pcp utilizes **Zero-Knowledge Proofs (ZKP)** for identity and authorization.

### ZKP Verification Flow

1.  **Claim Generation**: The agent generates a `ZkClaim` specifying the resource (path or action) and the intent.
2.  **Proof Submission**: The agent submits a `ZkProof` (generated via its private key) along with the command.
3.  **Engine Verification**: The `ZkEngine` verifies the proof against the claim without ever seeing the agent's private credentials.
4.  **Membrane Gate**: Only if ZKP verification passes does the command enter the Operational Membrane for admissibility checks.

```typescript
// Internal ZKP Verification logic in AgentNativeInterface
if (this.config.enforceZkp) {
  const claim: ZkClaim = {
    id: zkp.claimId,
    type: 'EXECUTE_ACTION',
    resource: action,
    timestamp: Date.now(),
  };

  const verification = await zkEngine.verify(claim, zkp);
  if (!verification.verified) {
    throw new Error(`ZKP Authorization failed: ${verification.error}`);
  }
}
```

## 4. Exposing Capabilities to Agents

To expose new capabilities to external agents, you define a semantic action and register its execution logic within the framework.

### Example: Exposing a "Smart Order" Capability

```typescript
import { AgentNativeInterface } from '../2030/agent-native';
import { Membrane } from '../membrane/membrane';

// 1. Define the capability logic
async function executeOrder(params: { symbol: string; amount: number }) {
  // Logic to interact with order book
  return { status: 'filled', price: 420.69 };
}

// 2. Extend the semantic dispatcher (Simplified example)
class MyAgentInterface extends AgentNativeInterface {
  protected async executeSemanticAction(action: string, params: any) {
    if (action === 'place_smart_order') {
      return executeOrder(params);
    }
    return super.executeSemanticAction(action, params);
  }
}

// 3. Usage by an External Agent
const command = {
  id: 'cmd_123',
  action: 'place_smart_order',
  params: { symbol: 'PCP', amount: 10 },
  zkp: {
    /* Cryptographic Proof */
  },
};

const result = await agentInterface.dispatch(command);
console.log(result.success ? 'Order Placed' : 'Execution Denied');
```

## 5. 2030 Best Practices

- **Deterministic Receipts**: Always ensure that your semantic actions return data that can be hashed into the `deltaHash` of the `MembraneReceipt`.
- **Granular Claims**: Use specific ZKP claims for read vs. write operations.
- **Ontology-Driven**: Map semantic actions to the application's ontology to allow the Membrane to automatically enforce trajectory transitions.
- **Quarantine on Fault**: The framework automatically isolates commands that crash the execution block, preventing cascading failures.
