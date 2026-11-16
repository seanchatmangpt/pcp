# CRDT Mathematics & Synchronization Deep Dive

This document details the mathematical foundations, implementation internals, and synchronization models of the Conflict-free Replicated Data Types (CRDTs) within the Pcp Framework SDK.

## 1. Introduction to CRDTs in Pcp

The Pcp Framework utilizes **State-based CRDTs** (also known as Convergent Replicated Data Types or CvRDTs) to ensure eventual consistency across distributed peers without the need for central coordination.

At the core of our synchronization engine is the requirement that all data types must form a **Join-Semilattice**.

### Mathematical Join-Semilattice Properties

For any CRDT state $S$, the merge operation $\sqcup$ must satisfy:

1.  **Commutativity**: $A \sqcup B = B \sqcup A$
    - The order in which updates are received does not affect the final state.
2.  **Associativity**: $(A \sqcup B) \sqcup C = A \sqcup (B \sqcup C)$
    - Grouping of updates does not affect the final state.
3.  **Idempotency**: $A \sqcup A = A$
    - Duplicate updates (common in unreliable networks) do not change the state.

## 2. Implementation Deep Dives

### 2.1 LWWRegister (Last-Write-Wins)

The `LWWRegister` implements a register where the "latest" write wins based on a timestamp.

**State Definition:**
$S = (v, t, p)$ where:

- $v$: The value.
- $t$: The wall-clock timestamp (or logical clock).
- $p$: The unique Peer ID (tie-breaker).

**Merge Function ($\sqcup$):**
$(v_1, t_1, p_1) \sqcup (v_2, t_2, p_2) = \begin{cases} (v_1, t_1, p_1) & \text{if } t_1 > t_2 \lor (t_1 = t_2 \land p_1 > p_2) \\ (v_2, t_2, p_2) & \text{otherwise} \end{cases}$

**Guarantees:**

- Provides a total ordering of updates.
- Guaranteed convergence to the value with the highest timestamp.
- Note: susceptible to clock skew if using wall-clock time; Pcp mitigates this with monotonic local clock increments.

### 2.2 PNCounter (Positive-Negative Counter)

The `PNCounter` allows both increments and decrements by composing two Grow-only Counters (GCounters).

**State Definition:**
A `PNCounter` is a pair of GCounters $(P, N)$.

- $P$: Increments.
- $N$: Decrements.
- Each GCounter is a vector: $G = \langle c_1, c_2, \dots, c_n \rangle$ where $c_i$ is the count for peer $i$.

**Value Calculation:**
$V = \sum P - \sum N$

**Merge Function ($\sqcup$):**
$(P_1, N_1) \sqcup (P_2, N_2) = (P_1 \sqcup P_2, N_1 \sqcup N_2)$
Where $G_1 \sqcup G_2 = \langle \max(G_{1,i}, G_{2,i}) \rangle$ for all $i$.

**Guarantees:**

- Monotonicity for individual $P$ and $N$ components.
- Convergence to the correct sum regardless of operation order.

### 2.3 LWWMap (Last-Write-Wins Map)

The `LWWMap` is a specialized map where each key maps to an `LWWRegister`.

**State Definition:**
$M = \{ k \to R_k \}$ where $R_k$ is an `LWWRegister`.

**Merge Function ($\sqcup$):**
$M_1 \sqcup M_2 = \{ k \to M_1(k) \sqcup M_2(k) \mid k \in \text{dom}(M_1) \cup \text{dom}(M_2) \}$
(If a key exists in only one map, it is treated as merged with a bottom/null register).

## 3. Synchronization & Consistency

### State-Based Synchronization Model

Pcp uses a **Push-Pull State Synchronization** model:

1.  **Gossip Protocol**: Peers periodically exchange state digests.
2.  **Full State Merge**: When a discrepancy is detected, the full state (or a delta) is transmitted and merged using the $\sqcup$ operator.
3.  **Monotonicity**: The state of a CRDT only ever moves "up" in the semilattice, ensuring that convergence is always progressing.

### Causal Consistency

While CRDTs provide eventual consistency, Pcp layers **Causal Consistency** using version vectors or hybrid logical clocks (HLCs). This ensures that if update $B$ depends on update $A$, no peer will see $B$ without having already applied $A$.

## 4. Custom CRDT Implementation

To implement a custom CRDT, extend the base types defined in `src/framework/sync/crdt/types.ts`.

### Example: Max-Register (G-Set variant)

```typescript
import { CRDT } from '../types';

/**
 * A register that only keeps the maximum value it has ever seen.
 */
export class MaxRegister implements CRDT<number, number> {
  private _value: number;

  constructor(initialValue: number = 0) {
    this._value = initialValue;
  }

  get state(): number {
    return this._value;
  }

  update(newValue: number): void {
    this._value = Math.max(this._value, newValue);
  }

  merge(other: number): void {
    this._value = Math.max(this._value, other);
  }

  toJSON(): number {
    return this._value;
  }
}
```

### Advanced: Multi-Value Register (OR-Set logic)

When "last-write-wins" is not acceptable, use a Multi-Value Register (MVR) which preserves concurrent writes until manually resolved.

## 5. React Integration

The Pcp Framework provides first-class React support for CRDTs via specialized hooks. These hooks manage the lifecycle of the CRDT instance and ensure the component re-renders when the state is updated (locally or via merge).

### `useCrdtState`

The base hook for any CRDT implementation.

```typescript
const [value, crdt, merge, forceUpdate] = useCrdtState(factory, peerId, initialState, getValue);
```

### Specialized Hooks

- `useLWWRegister(peerId, initialValue)`
- `usePNCounter(peerId, initialValue)`
- `useLWWMap(peerId, initialState)`

These hooks provide a more idiomatic interface for specific CRDT types, returning values and operation objects.

## 6. 2030 Best Practices

- **Zero-Trust Sync**: All incoming CRDT states must be validated against a schema before merging.
- **Delta-Compression**: For large maps or sets, Pcp implements delta-state CRDTs (δ-CRDTs) to reduce network overhead.
- **Formal Verification**: Use TLA+ or similar tools to verify that your custom `merge` operations are truly associative, commutative, and idempotent.
- **WASM Acceleration**: CRDT merge operations are computationally intensive for large states; Pcp offloads these to optimized WASM modules.

---

_Document Version: 1.0.0 (2030-05-24)_
_Scope: Deep-Dive / Mathematics / Synchronization_
