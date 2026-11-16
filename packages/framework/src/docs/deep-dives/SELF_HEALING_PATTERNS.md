# Self-Healing Patterns: Autonomous State Recovery

The Pcp Framework incorporates an advanced self-healing layer designed for high-availability systems where manual intervention is not an option. By combining cryptographic state proofing with autonomous recovery heuristics, Pcp ensures that business logic remains resilient even in the face of non-deterministic faults, deadlocks, or state corruption.

## Architectural Overview

Self-healing in Pcp is implemented through two primary modules:

1.  **`src/framework/membrane/self-healing`**: The low-level engine that monitors the Operational Membrane, detects anomalies, and manages state snapshots.
2.  **`src/framework/compositions/self-healing-logic`**: High-level React primitives and hooks that wrap business logic in resilient execution boundaries.

---

## Core Engine: `SelfHealingManager`

The `SelfHealingManager` is the brain of the recovery system. It operates by intercepting membrane operations and maintaining a rolling window of verified state snapshots.

### 1. Deadlock Detection

Pcp uses a temporal monitoring pattern to detect hung operations. Every operation initiated via `membrane.run()` is registered in an `activeOperations` map with a start timestamp.

- **Mechanism**: A background monitor (polling at 1Hz) compares the current time against the start time of all active operations.
- **Threshold**: Controlled by `deadlockTimeoutMs` (default: 5000ms).
- **Consequence**: If an operation exceeds the timeout, it is terminated, logged as a critical audit event, and an autonomous `heal()` cycle is triggered.

### 2. State Snapshotting

To enable recovery, Pcp captures "Last Known Good" (LKG) states of the target object.

- **Deterministic Association**: Snapshots are mapped to the `deltaHash` of the successful `MembraneReceipt` that produced that state.
- **Serialization**: Targets are serialized using deterministic JSON stringification.
- **Memory Management**: The manager maintains a configurable `maxSnapshots` limit (default: 50) using an LRU (Least Recently Used) eviction policy to balance recovery depth with memory overhead.

### 3. Recursive Rollback Strategy

When corruption or a deadlock is detected, the `heal()` method performs a recursive search through the receipt history:

1.  **Chain Validation**: It validates the cryptographic integrity of the receipt chain backwards from the point of failure.
2.  **Snapshot Search**: It searches for the most recent receipt that has a corresponding valid state snapshot.
3.  **State Restoration**: Once found, it performs a "hard reset" of the target object's properties and restores them from the snapshot.
4.  **Chain Reconstruction**: The receipt manager's history is truncated and reconstructed up to the restored point, ensuring the cryptographic "continuity of state" is maintained.

---

## Component Integration: `ResilientBoundary`

The `ResilientBoundary` is a React component that establishes a high-integrity environment for sensitive business logic. It orchestrates three layers of defense:

1.  **Operational Membrane**: Enforces admissibility and trajectory checks.
2.  **Autonomous Self-Healing**: Monitors for deadlocks and corruption.
3.  **Auto-Fix Error Boundary**: Catches UI-level crashes and attempts automated repair.

### Usage

```tsx
import { ResilientBoundary } from '@/framework/compositions/self-healing-logic';

export const SensitiveOperationContainer = ({ children }) => {
  return (
    <ResilientBoundary
      config={{ mode: 'strict', tenantId: 'prod-1' }}
      healingConfig={{ deadlockTimeoutMs: 3000, autoHeal: true }}>
      {children}
    </ResilientBoundary>
  );
};
```

---

## Advanced Orchestration: `useResilientCallback`

For complex business logic that requires retries and escalation, `useResilientCallback` provides a multi-tiered orchestration layer.

### Execution Flow

When the callback is invoked, it flows through:

1.  **`ActorSupervisor`**: Handles transient failures via exponential backoff and retry policies.
2.  **`Membrane`**: Validates the operation against security and business trajectories.
3.  **`SelfHealingManager`**: If the `ActorSupervisor` exhausts all retries, the hook automatically triggers a state rollback (healing) before re-throwing the error to the UI.

### Code Example

```typescript
import { useResilientCallback } from '@/framework/compositions/self-healing-logic';

const useUpdateLedger = () => {
  const updateLedger = useResilientCallback(
    async (transactionId: string, amount: number) => {
      // Sensitive financial logic
      const response = await api.post('/ledger', { transactionId, amount });
      return response.data;
    },
    'capability.financial.ledger_update',
    {
      retryLimit: 3,
      backoff: 'exponential',
    }
  );

  return updateLedger;
};
```

---

## 2030 Best Practices & Standards

To ensure zero issues in high-stakes environments, follow these implementation mandates:

- **Deterministic State**: Ensure the objects being protected by the membrane are purely serializable. Avoid classes with internal private state that cannot be captured via `JSON.stringify`.
- **Granular Capabilities**: Define highly specific `capabilityId`s. Large, monolithic capabilities make self-healing less effective as they increase the "blast radius" of a rollback.
- **Audit Everything**: All self-healing actions (snapshots, rollbacks, deadlock hits) are logged to the `AuditManager`. In production, these should be piped to a permanent cryptographic log (e.g., OTel + BLAKE3 receipts).
- **Idempotency**: Logic wrapped in `useResilientCallback` MUST be idempotent, as the `ActorSupervisor` or `SelfHealingManager` may re-execute or roll back the operation's side effects.
