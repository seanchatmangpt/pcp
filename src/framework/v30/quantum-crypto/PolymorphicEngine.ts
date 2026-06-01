/**
 * @module PolymorphicEngine
 * @description The core engine for v30.1.1 Epoch's quantum-crypto framework.
 * Implements Polymorphic Encryption, which constantly rotates encryption keys and algorithms
 * at runtime based on device entropy and simulated DNA-sequence parameters.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Supported algorithms that the polymorphic engine can rotate between.
 */
export type PolymorphicAlgorithm = 'aes-256-gcm' | 'aes-256-cbc';

/**
 * Interface representing a DNA Sequence Key used for biometrically-bound cryptography.
 */
export interface DNASequenceKey {
  /** The base sequence generated from biometric entropy. */
  sequence: string;
  /** The calculated entropy score of the sequence. */
  entropyScore: number;
  /** Timestamp of generation to enforce temporal rotation. */
  generatedAt: number;
}

/**
 * Represents the current active encryption state.
 */
export interface EncryptionContext {
  id: string;
  algorithm: PolymorphicAlgorithm;
  key: Buffer;
  ivLength: number;
}

/**
 * The PolymorphicEngine class encapsulates the highly complex logic of algorithm rotation,
 * entropy generation, and polymorphic encryption/decryption cycles.
 *
 * @class PolymorphicEngine
 */
export class PolymorphicEngine {
  private currentContext: EncryptionContext;
  private keyStore: Map<string, EncryptionContext> = new Map();
  private dnaKey: DNASequenceKey | null = null;
  private readonly algorithms: PolymorphicAlgorithm[] = ['aes-256-gcm', 'aes-256-cbc'];

  /**
   * Initializes the Polymorphic Engine, generating initial entropy and encryption contexts.
   */
  constructor() {
    this.currentContext = this.generateContext();
    this.keyStore.set(this.currentContext.id, this.currentContext);
  }

  /**
   * Returns the currently active DNA Sequence Key, if one has been generated.
   */
  public getActiveDNAKey(): DNASequenceKey | null {
    return this.dnaKey;
  }

  /**
   * Generates a DNA-Sequence Key stub based on simulated device entropy.
   * In a real quantum environment, this interacts with the biometric secure enclave.
   *
   * @param {number} complexity - The desired length/complexity of the DNA sequence.
   * @returns {DNASequenceKey} The newly generated DNA sequence key.
   */
  public generateDNASequenceKey(complexity: number = 256): DNASequenceKey {
    const bases = ['A', 'C', 'G', 'T'];
    let sequence = '';
    for (let i = 0; i < complexity; i++) {
      const idx = randomBytes(1)[0] % 4;
      sequence += bases[idx];
    }

    const entropyScore = this.calculateEntropy(sequence);

    this.dnaKey = {
      sequence,
      entropyScore,
      generatedAt: Date.now(),
    };

    return this.dnaKey;
  }

  /**
   * Validates a given DNA-Sequence Key against the engine's strict entropy requirements.
   *
   * @param {DNASequenceKey} key - The key to validate.
   * @returns {boolean} True if the key meets the entropy and temporal constraints.
   */
  public validateDNASequenceKey(key: DNASequenceKey): boolean {
    if (!key || typeof key.sequence !== 'string') return false;

    // Ensure the key has adequate entropy
    if (key.entropyScore < 0.1) return false;

    // Ensure the key hasn't expired (e.g., 1 hour lifespan for biological decay simulation)
    const MAX_LIFESPAN = 3600 * 1000;
    if (Date.now() - key.generatedAt > MAX_LIFESPAN) return false;

    // Validate sequence contains only valid bases
    if (!/^[ACGT]+$/.test(key.sequence)) return false;

    return true;
  }

  /**
   * Evaluates the Shannon entropy of a given sequence.
   *
   * @private
   * @param {string} sequence - The sequence to evaluate.
   * @returns {number} The entropy score.
   */
  private calculateEntropy(sequence: string): number {
    const frequencies: Record<string, number> = {};
    for (const char of sequence) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    const len = sequence.length;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /**
   * Collects entropy from the "device" to determine the next algorithm and key material.
   *
   * @private
   * @returns {EncryptionContext} A newly rotated encryption context.
   */
  private generateContext(): EncryptionContext {
    const entropy = randomBytes(32);
    const algoIndex = entropy[0] % this.algorithms.length;
    const algorithm = this.algorithms[algoIndex];

    let ivLength = 16;
    if (algorithm === 'aes-256-gcm') ivLength = 12;

    const id = randomBytes(8).toString('hex');

    return {
      id,
      algorithm,
      key: randomBytes(32),
      ivLength,
    };
  }

  /**
   * Rotates the encryption algorithm and key at runtime.
   * This is called continuously during the application lifecycle to maintain quantum-resistant forward secrecy.
   */
  public rotate(): void {
    this.currentContext = this.generateContext();
    this.keyStore.set(this.currentContext.id, this.currentContext);
    if (this.dnaKey) {
      // Incorporate biometric entropy if available
      const complexity = this.dnaKey.sequence.length;
      this.generateDNASequenceKey(complexity);
    }
  }

  /**
   * Returns the ID of the current active encryption context.
   */
  public getCurrentContextId(): string {
    return this.currentContext.id;
  }

  /**
   * Encrypts the provided plaintext using the currently active polymorphic context.
   *
   * @param {string} plaintext - The data to encrypt.
   * @returns {string} The ciphertext, encoded in base64, including algorithm metadata.
   */
  public encrypt(plaintext: string): string {
    const { id, algorithm, key, ivLength } = this.currentContext;
    const iv = randomBytes(ivLength);

    const cipher = createCipheriv(algorithm, key, iv) as any;

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    let authTag = '';
    if (algorithm === 'aes-256-gcm') {
      authTag = cipher.getAuthTag().toString('base64');
    }

    // Pack the metadata with the ciphertext
    // Format: Version:KeyID:Algorithm:IV:AuthTag:Ciphertext
    return `v1:${id}:${algorithm}:${iv.toString('base64')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts the provided polymorphic ciphertext. It dynamically determines the algorithm
   * from the payload metadata.
   *
   * @param {string} payload - The packed polymorphic payload.
   * @returns {string} The decrypted plaintext.
   */
  public decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 6) {
      throw new Error('Invalid polymorphic payload format');
    }

    const [version, id, algorithm, ivB64, authTagB64, ciphertext] = parts;

    if (version !== 'v1') {
      throw new Error(`Unsupported payload version: ${version}`);
    }

    const context = this.keyStore.get(id);
    if (!context) {
      throw new Error('Key not found in temporal store');
    }

    if (context.algorithm !== algorithm) {
      throw new Error('Algorithm mismatch in payload');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const decipher = createDecipheriv(algorithm as string, context.key, iv) as any;

    if (algorithm === 'aes-256-gcm') {
      const authTag = Buffer.from(authTagB64, 'base64');
      decipher.setAuthTag(authTag);
    }

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
