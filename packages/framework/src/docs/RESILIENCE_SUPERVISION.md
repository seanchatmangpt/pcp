# Resilience & Supervision Layers

The Pcp Framework SDK implements a multi-layered defense-in-depth strategy to ensure system integrity, autonomous recovery, and optimal performance under varying device conditions.

## Architecture Overview

1.  **Membrane (Resilience):** The operational boundary that enforces semantic laws, manages state snapshots, and provides autonomous self-healing.
2.  **Supervision (Heuristics):** A continuous monitoring layer that evaluates system health and detects anomalies using statistical and frequency-based heuristics.
3.  **2030 (Optimization):** A self-optimizing UX engine that dynamically adjusts application behavior based on real-time device vitals (FPS, thermal state, battery).

---

## 1. Operational Membrane & Governance

The **Operational Membrane** acts as a cryptographic and semantic barrier between the application logic and the underlying state. It ensures that every mutation is valid, audited, and reversible.

> **Deep Dive:** For a comprehensive theoretical and mathematical breakdown, see [The Mathematics of the Operational Membrane](./diataxis/explanation/MEMBRANE_MATH.md).

### Governance & Approval Flows

Managed by the `ApprovalFlowManager`, governance allows for multi-step verification of sensitive operations.

- **Tension-Based Interception:** Operations that meet specific "tension" criteria (e.g., high-value transfers, configuration changes) trigger an approval flow.
- **Semantic Verification:** Governance hooks can perform deep inspection of inputs before granting execution rights.
- **Multi-Step Approval:** Defines complex workflows requiring multiple actors or automated checks.

---

## 2. Autonomous Self-Healing

The `SelfHealingManager` provides the Pcp Framework with the ability to recover from state corruption and deadlocks without manual intervention.

### Key Mechanisms:

- **Integrity Monitoring:** Continuously validates the cryptographic receipt chain. If corruption is detected, it triggers an immediate rollback.
- **Deadlock Detection:** Monitors the duration of active operations. If an operation exceeds the `deadlockTimeoutMs`, it is terminated and the system is healed.
- **State Snapshotting:** Periodically captures serialized snapshots of the target state, associated with specific receipt hashes.
- **Rollback Recovery:** When healing is triggered, the manager identifies the last known good receipt with a valid snapshot and restores the system to that exact state.

---

## 3. Anomaly Detection Heuristics

The Supervision layer employs various heuristics to identify suspicious patterns that might indicate bugs, exploits, or infrastructure failures.

- **Frequency Heuristic:** Flags anomalies when the rate of events (e.g., mutations per second) exceeds a defined threshold.
- **Value Delta Heuristic:** Monitors specific state paths and triggers alerts if a single mutation causes a change larger than the `maxDelta`.
- **Variance Heuristic:** Uses statistical Z-score analysis to detect values that deviate significantly from historical means.
- **Composite Heuristic:** Allows combining multiple heuristics using `AND`/`OR` logic for sophisticated detection profiles.

---

## 4. Self-Optimizing UX Engine (2030 Optimization)

The `SelfOptimizingUXEngine` ensures a smooth user experience by throttling high-fidelity features based on device health.

### Optimization Profiles:

- **Peak:** Full fidelity, high-frequency updates, and advanced animations.
- **Balanced:** Minor throttling of non-essential background tasks.
- **Power Saver:** Reduced animation complexity, increased polling intervals.
- **Critical:** Disables all non-critical UI updates, minimizes CPU/GPU usage to prevent thermal shutdown.

### Monitored Vitals:

- **FPS:** Real-time frames-per-second monitoring.
- **Thermal State:** OS-level thermal pressure (nominal, fair, serious, critical).
- **Battery:** Level and charging status to determine power management strategy.

---

## Code Examples

### Using `ResilientBoundary`

Establish a high-integrity context for your application logic.

```tsx
import { ResilientBoundary } from '@pcp/framework';

const App = () => (
  <ResilientBoundary
    config={{ tenantId: 'prod-001' }}
    healingConfig={{ autoHeal: true, deadlockTimeoutMs: 3000 }}>
    <SensitiveComponent />
  </ResilientBoundary>
);
```

### Manual Self-Healing Control

Access the `SelfHealingManager` via context for fine-grained control.

```tsx
import { useResilientContext } from '@pcp/framework';

const HealingDashboard = () => {
  const { selfHealing } = useResilientContext();

  const handleManualHeal = async () => {
    const result = await selfHealing.heal();
    if (result.recovered) {
      console.log('System restored to:', result.lastGoodReceipt?.id);
    }
  };

  return <button onClick={handleManualHeal}>Force State Recovery</button>;
};
```

### Registering a Governance Flow

Define rules for when an operation requires supervision.

```typescript
const governance = new ApprovalFlowManager();

governance.registerConfig({
  capabilityPattern: 'vault:withdraw',
  tensionPredicate: (input) => input.amount > 1000,
  steps: [
    { id: 'mfa', label: 'Multi-Factor Auth' },
    { id: 'admin', label: 'Admin Approval' },
  ],
});
```
