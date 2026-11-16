/**
 * @fileoverview Consolidated test suite for the Post-Quantum Identity framework.
 */

import { PostQuantumZkEngine } from '../PostQuantumZkEngine';
import { ZkClaim } from '../../../auth/zkp/types';
import { PqZkProof, PqSignature } from '../types';
import { pqZkEngine } from '../index';
import { sha256 } from '@/src/lib/crypto/receipts';

const validSnarkProofData = JSON.stringify({
  pi_a: ['12345678901', '12345678902'],
  pi_b: [
    ['12345678903', '12345678904'],
    ['12345678905', '12345678906'],
  ],
  pi_c: ['12345678907', '12345678908'],
});

function generateLamportKeyPair(): { publicKey: string; privateKey: string[] } {
  const privateKey: string[] = [];
  let publicKey = '';
  for (let i = 0; i < 256; i++) {
    const sk0 = sha256(`sk_${i}_0_${Math.random()}`);
    const sk1 = sha256(`sk_${i}_1_${Math.random()}`);
    privateKey.push(sk0, sk1);
    publicKey += sha256(sk0) + sha256(sk1);
  }
  return { publicKey, privateKey };
}

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

describe('PostQuantumIdentity Framework', () => {
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

  it('should export a singleton instance', () => {
    expect(pqZkEngine).toBeInstanceOf(PostQuantumZkEngine);
  });

  it('should verify a standard ZK proof', async () => {
    const proof: PqZkProof = {
      claimId: 'claim-123-quantum',
      proofData: validSnarkProofData,
      publicSignals: ['18'],
      enclaveSignature: '0x' + '1'.repeat(40),
    };

    const result = await engine.verify(mockClaim, proof);
    expect(result.verified).toBe(true);
    expect(result.pqVerified).toBe(false);
    expect(result.quantumResistant).toBe(false);
  });

  describe('Post-Quantum Signature Verification', () => {
    it('verifies a valid Lamport signature (Dilithium5 or SPHINCS+) on a ZK proof', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const signatureData = signLamport(validSnarkProofData, privateKey);

      const pqSignature: PqSignature = {
        algorithm: 'Dilithium5',
        data: signatureData,
        publicKey: publicKey,
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: validSnarkProofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: '0x' + 'a'.repeat(40),
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(true);
      expect(result.pqVerified).toBe(true);
      expect(result.quantumResistant).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects an invalid/tampered signature on a ZK proof', async () => {
      const { publicKey, privateKey } = generateLamportKeyPair();
      const signatureData = signLamport(validSnarkProofData, privateKey);
      const tamperedSignature =
        signatureData.slice(0, -1) + (signatureData.slice(-1) === '0' ? '1' : '0');

      const pqSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: tamperedSignature,
        publicKey: publicKey,
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: validSnarkProofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: '0x' + 'a'.repeat(40),
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.verified).toBe(false);
      expect(result.pqVerified).toBe(false);
      expect(result.quantumResistant).toBe(false);
    });

    it('rejects a signature if length constraints fail', async () => {
      const pqSignature: PqSignature = {
        algorithm: 'SPHINCS+',
        data: 'a'.repeat(16383), // Invalid signature length
        publicKey: 'b'.repeat(32768),
      };

      const proof: PqZkProof = {
        claimId: 'claim-123-quantum',
        proofData: validSnarkProofData,
        publicSignals: ['18'],
        pqSignature,
        enclaveSignature: '0x' + 'a'.repeat(40),
      };

      const result = await engine.verify(mockClaim, proof);
      expect(result.pqVerified).toBe(false);
      expect(result.verified).toBe(false);
    });
  });
});
