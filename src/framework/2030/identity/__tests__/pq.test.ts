/**
 * @fileoverview Complete, zero-stub tests for post-quantum cryptographic hash binding
 * and signature validation in the Pcp Framework.
 *
 * Clickable file references:
 * Source: file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts
 * Tests: file:///Users/sac/pcpapp/src/framework/2030/identity/__tests__/pq.test.ts
 */

import { PostQuantumZkEngine } from '../PostQuantumZkEngine';
import { ZkClaim } from '../../../auth/zkp/types';
import { PqZkProof, PqSignature, PqReceipt } from '../types';
import { sha256, canonicalStringify } from '@/src/lib/crypto/receipts';

const validSnarkProofData = JSON.stringify({
  pi_a: ['12345678901', '12345678902'],
  pi_b: [
    ['12345678903', '12345678904'],
    ['12345678905', '12345678906'],
  ],
  pi_c: ['12345678907', '12345678908'],
});

/**
 * Generates a cryptographically valid Lamport key pair.
 * Lamport signatures are quantum-resistant and hash-based.
 * Each of the 256 bits of the message hash is signed using a pair of secret keys.
 */
function generateLamportKeyPair(): { publicKey: string; privateKey: string[] } {
  const privateKey: string[] = [];
  let publicKey = '';
  for (let i = 0; i < 256; i++) {
    // Generate secret keys for bit = 0 and bit = 1
    const sk0 = sha256(`sk_${i}_0_${Math.random()}`);
    const sk1 = sha256(`sk_${i}_1_${Math.random()}`);
    privateKey.push(sk0, sk1);
    publicKey += sha256(sk0) + sha256(sk1);
  }
  return { publicKey, privateKey };
}

/**
 * Signs a message using a Lamport private key.
 */
function signLamport(message: string, privateKey: string[]): string {
  const msgHash = sha256(message);
  let signature = '';
  for (let i = 0; i < 256; i++) {
    const charIndex = Math.floor(i / 4);
    const bitIndex = i % 4;
    const hexChar = msgHash[charIndex];
    const val = parseInt(hexChar, 16);
    const bit = val & (1 << bitIndex) ? 1 : 0;

    const sk = privateKey[i * 2 + bit];
    signature += sk;
  }
  return signature;
}

describe('PostQuantumZkEngine Cryptographic Verification', () => {
  let engine: PostQuantumZkEngine;
  const mockClaim: ZkClaim = {
    id: 'claim-123-quantum',
    field: 'votingAge',
    operator: 'GTE',
    threshold: 18,
  };

  beforeEach(() => {
    engine = new PostQuantumZkEngine();
  });

  describe('Post-Quantum Signature Verification', () => {
    it('verifies a valid Lamport signature on a ZK proof', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;

      const signatureData = signLamport(proofData, privateKey);
      const pqSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: signatureData,
        publicKey: publicKey,
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true);
      expect(result.pqVerified).toBe(true);
      expect(result.quantumResistant).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects an invalid/tampered Lamport signature on a ZK proof', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;

      const signatureData = signLamport(proofData, privateKey);
      // Tamper with the signature by altering the last character
      const tamperedSignature =
        signatureData.slice(0, -1) + (signatureData.slice(-1) === '0' ? '1' : '0');

      const pqSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: tamperedSignature,
        publicKey: publicKey,
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(false);
      expect(result.pqVerified).toBe(false);
      expect(result.quantumResistant).toBe(false);
    });

    it('rejects a signature if the public key length or signature length is invalid', async () => {
      const pqSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: 'a'.repeat(16383), // Invalid length (expected 16384)
        publicKey: 'b'.repeat(32768),
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: validSnarkProofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.pqVerified).toBe(false);
      expect(result.verified).toBe(false);
    });
  });

  describe('Post-Quantum Receipt Hash Binding Verification', () => {
    it('verifies a valid receipt with correct hash binding and signature', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;
      const expectedZkProofHash = sha256(proofData);

      // Create the unsigned receipt structure
      const partialReceipt: Omit<PqReceipt, 'pqSignature'> = {
        version: '2030.1',
        timestamp: Date.now(),
        claimId: 'claim-123-quantum',
        zkProofHash: expectedZkProofHash,
      };

      // Sign the canonical receipt stringification to create the signature
      const receiptSerialized = canonicalStringify(partialReceipt);
      const signatureData = signLamport(receiptSerialized, privateKey);

      const receipt: PqReceipt = {
        ...partialReceipt,
        pqSignature: {
          algorithm: 'SPHINCS+',
          data: signatureData,
          publicKey: publicKey,
        },
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        receipt,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true);
      expect(result.receiptVerified).toBe(true);
      expect(result.quantumResistant).toBe(false); // quantumResistant requires both proof signature AND receipt signature
    });

    it('verifies a valid receipt with version 2030.1.1', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;
      const expectedZkProofHash = sha256(proofData);

      const partialReceipt: Omit<PqReceipt, 'pqSignature'> = {
        version: '2030.1.1',
        timestamp: Date.now(),
        claimId: 'claim-123-quantum',
        zkProofHash: expectedZkProofHash,
      };

      const receiptSerialized = canonicalStringify(partialReceipt);
      const signatureData = signLamport(receiptSerialized, privateKey);

      const receipt: PqReceipt = {
        ...partialReceipt,
        pqSignature: {
          algorithm: 'SPHINCS+',
          data: signatureData,
          publicKey: publicKey,
        },
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        receipt,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true);
      expect(result.receiptVerified).toBe(true);
      expect(result.quantumResistant).toBe(false);
    });

    it('rejects a receipt if the zkProofHash is not bound to the zkProofData', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;

      // Incorrect hash binding
      const incorrectZkProofHash = sha256('tampered-or-different-proof-data');

      const partialReceipt: Omit<PqReceipt, 'pqSignature'> = {
        version: '2030.1',
        timestamp: Date.now(),
        claimId: 'claim-123-quantum',
        zkProofHash: incorrectZkProofHash,
      };

      const receiptSerialized = canonicalStringify(partialReceipt);
      const signatureData = signLamport(receiptSerialized, privateKey);

      const receipt: PqReceipt = {
        ...partialReceipt,
        pqSignature: {
          algorithm: 'SPHINCS+',
          data: signatureData,
          publicKey: publicKey,
        },
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        receipt,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true); // Standard verification succeeds, but receipt fails
      expect(result.receiptVerified).toBe(false);
    });

    it('rejects a receipt if the receipt signature is invalid', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const proofData = validSnarkProofData;
      const expectedZkProofHash = sha256(proofData);

      const partialReceipt: Omit<PqReceipt, 'pqSignature'> = {
        version: '2030.1',
        timestamp: Date.now(),
        claimId: 'claim-123-quantum',
        zkProofHash: expectedZkProofHash,
      };

      // Generate a valid signature but for a DIFFERENT receipt message
      const signatureData = signLamport('some-other-receipt-content', privateKey);

      const receipt: PqReceipt = {
        ...partialReceipt,
        pqSignature: {
          algorithm: 'SPHINCS+',
          data: signatureData,
          publicKey: publicKey,
        },
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        receipt,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.receiptVerified).toBe(false);
    });
  });

  describe('Full End-to-End Quantum-Resistant Identity', () => {
    it('sets quantumResistant to true only when both proof and receipt are fully verified cryptographically', async () => {
      const proofKeypair = generateLamportKeyPair();
      const receiptKeypair = generateLamportKeyPair();
      const proofData = validSnarkProofData;

      const proofSigData = signLamport(proofData, proofKeypair.privateKey);
      const proofSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: proofSigData,
        publicKey: proofKeypair.publicKey,
      };

      const expectedZkProofHash = sha256(proofData);
      const partialReceipt: Omit<PqReceipt, 'pqSignature'> = {
        version: '2030.1',
        timestamp: Date.now(),
        claimId: 'claim-123-quantum',
        zkProofHash: expectedZkProofHash,
      };

      const receiptSerialized = canonicalStringify(partialReceipt);
      const receiptSigData = signLamport(receiptSerialized, receiptKeypair.privateKey);
      const receiptSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: receiptSigData,
        publicKey: receiptKeypair.publicKey,
      };

      const receipt: PqReceipt = {
        ...partialReceipt,
        pqSignature: receiptSignature,
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: proofData,
        publicSignals: ['18'],
        pqSignature: proofSignature,
        receipt,
        enclaveSignature: 'valid-signature',
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true);
      expect(result.pqVerified).toBe(true);
      expect(result.receiptVerified).toBe(true);
      expect(result.quantumResistant).toBe(true);
    });
  });
});
