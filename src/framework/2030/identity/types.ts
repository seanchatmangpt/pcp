/**
 * @fileoverview Type definitions for Post-Quantum Identity and Cryptography.
 */

import { ZkClaim, ZkProof, ZkVerificationResult } from '../../auth/zkp/types';

/**
 * Supported Post-Quantum Signature Algorithms.
 */
export type PqAlgorithm =
  | 'Dilithium2'
  | 'Dilithium3'
  | 'Dilithium5'
  | 'Falcon-512'
  | 'Falcon-1024'
  | 'SPHINCS+';

/**
 * Abstraction for a Post-Quantum Cryptographic Signature.
 */
export interface PqSignature {
  algorithm: PqAlgorithm;
  data: string; // Base64 encoded signature
  publicKey: string; // Base64 encoded public key
}

/**
 * Enhanced ZKP Proof that includes Post-Quantum Receipts.
 */
export interface PqZkProof extends ZkProof {
  pqSignature?: PqSignature;
  receipt?: PqReceipt;
}

/**
 * Post-Quantum Cryptographic Receipt.
 */
export interface PqReceipt {
  version: '2030.1' | '2030.1.1';
  timestamp: number;
  claimId: string;
  zkProofHash: string; // Hash of the ZK proof
  pqSignature: PqSignature;
  metadata?: Record<string, any>;
}

/**
 * Enhanced Verification Result with PQ integrity check.
 */
export interface PqVerificationResult extends ZkVerificationResult {
  pqVerified: boolean;
  receiptVerified: boolean;
  quantumResistant: boolean;
}

/**
 * Interface for a Post-Quantum ZKP Provider.
 */
export interface PqZkProvider {
  verify(claim: ZkClaim, proof: PqZkProof): Promise<PqVerificationResult>;
}
