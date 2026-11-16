# Tutorial: Developing Agent-Native Capabilities

In the Pcp 2030 vision, AI agents are not mere consumers of APIs—they are primary operators within the system. Developing an **Agent-Native** application means designing interfaces that allow autonomous intelligence to securely inspect state, understand context, and express intent through semantic commands.

This tutorial guides you through exposing your application's internal logic to external LLMs using the `AgentNativeInterface`.

---

## What You Will Learn

1.  How to initialize the `AgentNativeInterface`.
2.  How to expose internal application state via semantic JSON paths.
3.  How to define and handle **Semantic Commands**.
4.  How to secure agent interactions using **Zero-Knowledge Proofs (ZKP)**.

---

## Prerequisites

- Pcp Framework 2030 environment.
- Understanding of the **Operational Membrane** (see [Membrane Deep Dive](../../deep-dives/MEMBRANE.md)).
- Basic knowledge of TypeScript and async/await patterns.

---

## Step 1: Initialize the Agent-Native Gateway

The `AgentNativeInterface` acts as a secure portal between your application's "trusted core" and the "untrusted" agent space. It requires an **Operational Membrane** to govern execution and an initial application state.

Create a new file `src/features/agent-gateway.ts`:

```typescript
import { AgentNativeInterface } from '../framework/2030/agent-native';
import { Membrane } from '../framework/membrane/membrane';

// 1. Define the internal state you want to expose
const appState = {
  mission: {
    status: 'active',
    priority: 'high',
    coordinates: { x: 42, y: 88 },
  },
  logs: [],
};

// 2. Instantiate the Operational Membrane
const membrane = new Membrane();

// 3. Initialize the Gateway
const agentGateway = new AgentNativeInterface(membrane, appState, {
  enforceZkp: true, // Enforce post-quantum authorization
  membraneId: 'mission-ctrl', // Boundary identifier for receipts
});
```

---

## Step 2: Exposing State via Semantic Paths

Agents perform best when they can "query" the world using human-readable paths rather than complex SQL or REST endpoints. Pcp's `inspectState` method allows agents to request specific slices of state.

To allow an agent to read your mission coordinates:

```typescript
async function handleAgentQuery(zkProof: any) {
  const result = await agentGateway.inspectState({
    path: 'mission.coordinates',
    zkp: zkProof, // Cryptographic proof of 'READ_ACCESS'
  });

  console.log('Agent received coordinates:', result); // { x: 42, y: 88 }
}
```

**2030 Best Practice:** Use a "Flat & Semantic" state tree. Instead of `data.tbl_users_v2[0].pref`, use `user.preferences`. This reduces the token cost for LLMs to understand your system.

---

## Step 3: Defining Semantic Commands

A **Semantic Command** is a high-level intent (e.g., `rebalance_energy`) that the agent dispatches. To implement custom logic, you extend the `AgentNativeInterface` and override its dispatcher.

```typescript
class MissionAgentInterface extends AgentNativeInterface {
  /**
   * Maps semantic intent to internal execution logic.
   */
  protected async executeSemanticAction(action: string, params: any) {
    switch (action) {
      case 'adjust_coordinates':
        return this.performCoordinateShift(params.x, params.y);

      case 'abort_mission':
        return { status: 'aborted', timestamp: Date.now() };

      default:
        // Fallback to default framework actions (like 'ping' or 'update_state')
        return super.executeSemanticAction(action, params);
    }
  }

  private performCoordinateShift(x: number, y: number) {
    // Business logic goes here...
    return { success: true, newPos: { x, y } };
  }
}
```

---

## Step 4: Dispatching and Receipting

When an agent dispatches a command, the Pcp Framework doesn't just "run" it. It passes the command through the **Operational Membrane**, which:

1.  Verifies the **ZKP Authorization**.
2.  Checks for **Admissibility** (is the action allowed right now?).
3.  Generates a **Membrane Receipt** (an immutable audit trail).

```typescript
const command = {
  id: 'cmd_gamma_9',
  action: 'adjust_coordinates',
  params: { x: 10, y: 20 },
  zkp: { claimId: 'auth_exec', proof: '...' },
};

const result = await missionGateway.dispatch(command);

if (result.success) {
  console.log(`Action Approved. Receipt: ${result.receiptId}`);
} else {
  console.log(`Action Denied: ${result.error}`);
}
```

---

## Security: The ZKP-First Mandate

In the 2030 ecosystem, we **never** use API keys for agents. API keys can be leaked by LLMs in their context windows. Instead, Pcp uses **Zero-Knowledge Proofs**:

- **Claim**: "I am an agent authorized to READ `mission.status`."
- **Proof**: A cryptographic blob that proves the claim without revealing the agent's private key.
- **Verification**: The `AgentNativeInterface` verifies this proof instantly before any data is leaked or any code is run.

---

## Summary & Next Steps

You have successfully built an Agent-Native bridge! Your application is now ready to be operated by autonomous intelligence.

- **Learn More**: Explore the [Semantic Ontology How-To](../../how-to/ONTOLOGY.md) to learn how to define formal laws for your agent commands.
- **Deep Dive**: Read about the [Post-Quantum Identity Engine](../../deep-dives/ZKP_IDENTITY.md) to understand the math behind ZKP verification.
