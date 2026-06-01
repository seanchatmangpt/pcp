/**
 * @fileoverview Test suite for the Post-Quantum Identity framework.
 *
 * Clickable file references:
 * - Source: [PostQuantumZkEngine.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts)
 * - Types: [types.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/types.ts)
 * - Test: [PostQuantumIdentity.test.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/__tests__/PostQuantumIdentity.test.ts)
 */

import { PostQuantumZkEngine } from '../PostQuantumZkEngine';
import { ZkClaim } from '../../../auth/zkp/types';
import { PqZkProof, PqSignature, PqReceipt } from '../types';
import { pqZkEngine } from '../index';

const validSnarkProofData = JSON.stringify({
  pi_a: ['12345678901', '12345678902'],
  pi_b: [
    ['12345678903', '12345678904'],
    ['12345678905', '12345678906'],
  ],
  pi_c: ['12345678907', '12345678908'],
});

describe('PostQuantumZkEngine', () => {
  let engine: PostQuantumZkEngine;
  const mockClaim: ZkClaim = {
    id: 'claim-123',
    field: 'age',
    operator: 'GTE',
    threshold: 18,
  };

  beforeEach(() => {
    engine = new PostQuantumZkEngine();
  });

  it('should export a singleton instance', () => {
    expect(pqZkEngine).toBeInstanceOf(PostQuantumZkEngine);
  });

  it('should verify a standard ZK proof', async () => {
    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.pqVerified).toBe(false);
    expect(result.quantumResistant).toBe(false);
  });

  it('should verify a proof with PQ signature', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Dilithium5',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      pqSignature,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.pqVerified).toBe(true);
    expect(result.quantumResistant).toBe(true);
  });

  it('should fail if PQ signature is invalid', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Dilithium5',
      data: 'INVALID_SIG',
      publicKey: 'valid-pubkey',
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      pqSignature,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(false);
    expect(result.pqVerified).toBe(false);
  });

  it('should fail if PQ signature data is missing', async () => {
    const pqSignature: any = {
      algorithm: 'Dilithium5',
      publicKey: 'valid-pubkey',
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      pqSignature,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.pqVerified).toBe(false);
  });

  it('should verify a proof with PQ receipt', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Falcon-1024',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const receipt: PqReceipt = {
      version: '2030.1',
      timestamp: Date.now(),
      claimId: 'claim-123',
      zkProofHash: 'c1f64477c049ca1d3d1dfdde3731fd29af149d105a09fe9529ac44e58f8f9f37',
      pqSignature,
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.receiptVerified).toBe(true);
  });

  it('should verify a proof with PQ receipt version 2030.1.1', async () => {
    // See [PostQuantumZkEngine.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts) for details.
    const pqSignature: PqSignature = {
      algorithm: 'Falcon-1024',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const receipt: PqReceipt = {
      version: '2030.1.1',
      timestamp: Date.now(),
      claimId: 'claim-123',
      zkProofHash: 'c1f64477c049ca1d3d1dfdde3731fd29af149d105a09fe9529ac44e58f8f9f37',
      pqSignature,
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.receiptVerified).toBe(true);
  });

  it('should fail if PQ receipt version is invalid', async () => {
    const receipt: any = {
      version: '2025.1',
      pqSignature: {
        algorithm: 'Dilithium2',
        data: 'valid',
        publicKey: 'valid',
      },
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.receiptVerified).toBe(false);
  });

  it('should fail standard verification if claimId mismatch', async () => {
    const proof: PqZkProof = {
      claimId: 'wrong-claim',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Proof claimId mismatch');
  });

  it('should fail if standard verification fails even if PQ signature is valid', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Dilithium5',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const proof: PqZkProof = {
      claimId: 'wrong-claim',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      pqSignature,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(false);
    expect(result.pqVerified).toBe(true);
  });

  it('should verify a proof with ONLY PQ receipt', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Falcon-1024',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const receipt: PqReceipt = {
      version: '2030.1',
      timestamp: Date.now(),
      claimId: 'claim-123',
      zkProofHash: 'c1f64477c049ca1d3d1dfdde3731fd29af149d105a09fe9529ac44e58f8f9f37',
      pqSignature,
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.receiptVerified).toBe(true);
    expect(result.quantumResistant).toBe(false); // Because pqSignature on proof is missing
  });

  it('should fail if PQ receipt signature is invalid', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Falcon-1024',
      data: 'INVALID_SIG',
      publicKey: 'valid-pubkey',
    };

    const receipt: PqReceipt = {
      version: '2030.1',
      timestamp: Date.now(),
      claimId: 'claim-123',
      zkProofHash: 'c1f64477c049ca1d3d1dfdde3731fd29af149d105a09fe9529ac44e58f8f9f37',
      pqSignature,
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.receiptVerified).toBe(false);
  });

  it('should fail if PQ receipt has mismatched zkProofHash', async () => {
    const pqSignature: PqSignature = {
      algorithm: 'Falcon-1024',
      data: 'valid-signature',
      publicKey: 'valid-pubkey',
    };

    const receipt: PqReceipt = {
      version: '2030.1',
      timestamp: Date.now(),
      claimId: 'claim-123',
      zkProofHash: 'mismatched-hash-value',
      pqSignature,
    };

    const proof: PqZkProof = {
      claimId: 'claim-123',
      proofData: 'mock-proof-data',
      publicSignals: ['18'],
      receipt,
      enclaveSignature: 'valid-signature',
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.receiptVerified).toBe(false);
  });
});
