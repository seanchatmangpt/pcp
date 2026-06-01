# Zero-Knowledge Proof (ZKP) & Post-Quantum Identity

## Overview

The Pcp Framework SDK provides a cutting-edge identity layer that prioritizes privacy and future-proof security. By leveraging **Zero-Knowledge Proofs (ZKP)** and **Post-Quantum Cryptography (PQC)**, Pcp enables "Selective Disclosure"—allowing users to prove attributes (e.g., "I am over 18") without revealing the underlying data (e.g., actual birth date).

## Architecture & Modules

The identity framework is partitioned into two primary modules:

### 1. Standard ZKP (`src/framework/auth/zkp`)

The foundation for Zero-Knowledge operations. It provides the abstractions for claims, proofs, and the core verification engine.

- **`ZkEngine`**: The primary verifier for standard ZK proofs.
- **`useZkClaimVerifier`**: A React hook for seamless UI integration.
- **`types.ts`**: Defines the structural interface for ZK operations.

### 2. Post-Quantum Identity (`src/framework/2030/identity`)

An extension of the standard ZKP module that introduces quantum-resistant layers, adhering to 2030 cryptographic standards.

- **`PostQuantumZkEngine`**: Extends `ZkEngine` to verify PQ signatures and receipts.
- **`PqReceipt`**: A cryptographic receipt signed with PQ algorithms, ensuring the integrity of the ZK proof even in a post-quantum world.
- **`pqZkEngine`**: A singleton instance of the PQ-enhanced engine.

---

## Technical Implementation

### ZKP Verification Engine

The `ZkEngine` follows a provider-based architecture. It handles the structural validation of proofs and delegates the heavy lifting to cryptographic backends.

#### Simulation vs. Production

- **Developer Experience (DX)**: By default, the SDK uses a high-fidelity simulation that validates the structure of proofs (matching `claimId`, checking for `proofData` and `publicSignals`). This allows rapid prototyping without local WASM overhead.
- **Production Path**: In production environments, the engine can be wired into the `@truex/zkp` package or the low-level `verifyZKProofReceipt` function (found in `src/lib/crypto/receipts.ts`), which performs full BN254 curve point validation and pairing checks.

```typescript
// Core verification loop in ZkEngine
async verify(claim: ZkClaim, proof: ZkProof): Promise<ZkVerificationResult> {
  if (proof.claimId !== claim.id) {
    return { verified: false, claimId: claim.id, timestamp: Date.now(), error: 'Proof claimId mismatch' };
  }
  const isValid = await this.performCryptographicVerification(claim, proof);
  return { verified: isValid, claimId: claim.id, timestamp: Date.now() };
}
```

### Post-Quantum Cryptographic Stubs

The `PostQuantumZkEngine` introduces support for NIST-standardized PQ algorithms. It verifies that a ZK proof hasn't been tampered with by checking an attached **Post-Quantum Signature**.

- **Algorithms**: Support for **Dilithium** (2, 3, 5) and **Falcon** (512, 1024).
- **Quantum-Resistant Integrity**: Ensures that every ZK proof is backed by a PQ signature, preventing "harvest now, decrypt later" attacks on identity metadata.

#### Post-Quantum Receipts (PQ-Receipts)

A `PqReceipt` is a versioned attestation (`2030.1`) that binds a ZK proof to a specific point in time and a specific claim.

```typescript
export interface PqReceipt {
  version: '2030.1';
  timestamp: number;
  claimId: string;
  zkProofHash: string; // Hash binding this receipt to the ZK proof
  pqSignature: PqSignature;
}
```

---

## Selective Disclosure Flow

Pcp implements a user-centric selective disclosure flow:

1.  **Claim Definition**: The application defines what it needs to know (e.g., `age >= 18`).
2.  **Proving (Client-Side)**: The Pcp SDK (or a linked wallet) generates a ZK proof using the user's private data stored locally.
3.  **Verification (On-Device)**: The application's `ZkEngine` verifies the proof. The actual value (the birth date) never leaves the user's secure storage.
4.  **PQ-Hardening**: For high-value transactions, a `PqReceipt` is attached to the proof, providing a quantum-resistant audit trail.

---

## Code Examples

### Defining a ZK Claim

A `ZkClaim` defines the logic for selective disclosure.

```typescript
import { ZkClaim } from '@pcp/framework/auth/zkp';

const ageClaim: ZkClaim = {
  id: 'identity-v1-age-verification',
  field: 'age',
  operator: 'GTE',
  threshold: 18,
  description: 'Proof that the user is 18 years of age or older.',
};
```

### On-Device Verification (Using Hooks)

The `useZkClaimVerifier` hook manages the loading state and results of a verification.

```tsx
import { useZkClaimVerifier, ZkClaim, ZkProof } from '@pcp/framework/auth/zkp';

export function VerificationComponent() {
  const { verifyClaim, isVerifying, result } = useZkClaimVerifier();

  const onScanProof = async (proof: ZkProof) => {
    const claim: ZkClaim = { id: 'over-18', field: 'age', operator: 'GTE', threshold: 18 };
    await verifyClaim(claim, proof);
  };

  return (
    <View>
      {isVerifying && <ActivityIndicator />}
      {result?.verified && <Text>Identity Verified!</Text>}
      <Button title="Verify" onPress={() => onScanProof(scannedProof)} />
    </View>
  );
}
```

### Post-Quantum Verification

For 2030-compliant security, utilize the `pqZkEngine` singleton.

```typescript
import { pqZkEngine, PqZkProof } from '@pcp/framework/2030/identity';

async function secureLogin(claim: ZkClaim, proof: PqZkProof) {
  const result = await pqZkEngine.verify(claim, proof);

  if (result.verified && result.quantumResistant) {
    console.log('Post-Quantum Identity Verified.');
  }
}
```

## 2030 Best Practices

- **Minimize Disclosure**: Always use the most restrictive ZK operator (e.g., use `EQ` for status checks, `GTE` for age).
- **Enforce PQ-Receipts**: In 2030 environments, reject any ZK proof that does not come with a valid `PqReceipt` version `2030.1`.
- **Local Verification**: Always perform `ZkEngine.verify()` on the user's device to ensure end-to-end privacy.
- **Handle Edge Cases**: Always check `result.error` to provide meaningful feedback to the user when verification fails (e.g., "Proof expired", "Invalid signature").
