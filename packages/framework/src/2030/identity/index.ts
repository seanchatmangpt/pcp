/**
 * @fileoverview Entry point for the Post-Quantum Identity framework.
 */

export * from './types';
export * from './PostQuantumZkEngine';

import { PostQuantumZkEngine } from './PostQuantumZkEngine';

/**
 * Singleton instance of the Post-Quantum ZKP Engine.
 */
export const pqZkEngine = new PostQuantumZkEngine();
