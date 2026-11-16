import { Membrane } from '../../membrane/membrane';
import { pqZkEngine } from '../identity';
import {
  SemanticCommand,
  AgentExecutionResult,
  AgentNativeConfig,
  StateInspectionRequest,
} from './types';
import { ZkClaim } from '../../auth/zkp/types';

/**
 * The Agent-First Interface provides a secure, ZKP-verified gateway for
 * external AI agents to interact with the Pcp Framework.
 */
export class AgentNativeInterface {
  private membrane: Membrane;
  private config: AgentNativeConfig;
  private state: any;
  private commandQueue: Promise<any> = Promise.resolve();

  constructor(membrane: Membrane, state: any, config: AgentNativeConfig) {
    this.membrane = membrane;
    this.state = this.deepClone(state);
    this.config = this.deepClone(config);
    // Version-dependent startup logging for Pcp 2030.1.1-ultimate.
    // See [agent-native.md](file:///Users/sac/pcpapp/docs/vision2030/modules/agent-native.md) for architectural guidelines.
    console.log(
      `[Pcp 2030.1.1-ultimate] AgentNativeInterface initialized with membrane: ${config.membraneId}`
    );
  }

  /**
   * Helper to sanitize paths against prototype pollution.
   */
  private sanitizePath(path: string): string[] {
    const keys = path.split('.');
    if (keys.includes('__proto__') || keys.includes('constructor') || keys.includes('prototype')) {
      throw new Error(
        `Access to prototype-modifying keys is forbidden: Prototype pollution attempt detected in path: ${path}`
      );
    }
    return keys;
  }

  /**
   * Helper to perform a deep clone on an object to prevent reference leakage.
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    // Do not clone class instances (e.g., LogGenerator, Membrane, etc.) to preserve methods
    if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item));
    }
    const clone: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        clone[key] = this.deepClone(obj[key]);
      }
    }
    return clone;
  }

  /**
   * Allows an agent to inspect the application state if authorized via ZKP.
   */
  public async inspectState(request: StateInspectionRequest): Promise<any> {
    const { path, zkp } = request;

    // 1. ZKP Verification
    if (this.config.enforceZkp) {
      const claim: ZkClaim = {
        id: zkp.claimId,
        field: path,
        operator: 'EQ',
        threshold: 1,
        description: `Read access authorization for path ${path}`,
      };

      // Leverage post-quantum ZK verification for Pcp 2030.1.1-ultimate.
      // Validates PqReceipt version constraints (2030.1/2030.1.1) in [PostQuantumZkEngine.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts).
      const verification = await pqZkEngine.verify(claim, zkp);
      if (!verification.verified) {
        throw new Error(`ZKP Verification failed for path: ${path}. Error: ${verification.error}`);
      }
    }

    // 2. State Access (Cloned to prevent reference leakage)
    const rawValue = this.resolvePath(this.state, path);
    return this.deepClone(rawValue);
  }

  /**
   * Dispatches a semantic command from an agent through the Operational Membrane.
   */
  public async dispatch<T = any>(command: SemanticCommand): Promise<AgentExecutionResult<T>> {
    // Optionally emit EnqueueCommand event to the log generator.
    // For schema definitions, see [process-mining.ts](file:///Users/sac/pcpapp/src/framework/2030/agent-native/process-mining.ts).
    if (this.config.logGenerator) {
      this.config.logGenerator.addObject(command.id, 'command', {
        action: command.action,
        params: this.deepClone(command.params),
      });
      this.config.logGenerator.addObject(this.config.membraneId, 'membrane', {
        membraneId: this.config.membraneId,
      });
      this.config.logGenerator.addEvent('EnqueueCommand', [command.id, this.config.membraneId], {
        timestamp: new Date().toISOString(),
      });
    }

    return new Promise<AgentExecutionResult<T>>((resolve, reject) => {
      this.commandQueue = this.commandQueue
        .then(async () => {
          try {
            const result = await this.executeDispatchInternal<T>(command);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .catch(() => {
          // Prevent queue lock if an unhandled rejection occurs
        });
    });
  }

  private async executeDispatchInternal<T = any>(
    command: SemanticCommand
  ): Promise<AgentExecutionResult<T>> {
    const { id, action, params, zkp } = command;

    let verified = true;
    let verificationError: string | undefined = undefined;

    // 1. ZKP Verification
    if (this.config.enforceZkp) {
      const claim: ZkClaim = {
        id: zkp.claimId,
        field: action,
        operator: 'EQ',
        threshold: 1,
        description: `Execution authorization for action ${action}`,
      };

      // Leverage post-quantum ZK verification for Pcp 2030.1.1-ultimate.
      // Validates PqReceipt version constraints (2030.1/2030.1.1) in [PostQuantumZkEngine.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts).
      const verification = await pqZkEngine.verify(claim, zkp);
      verified = verification.verified;
      verificationError = verification.error;

      if (this.config.logGenerator) {
        this.config.logGenerator.addObject(zkp.claimId || 'unknown_claim', 'proof', {
          claimId: zkp.claimId,
          verified,
        });
        this.config.logGenerator.addEvent('VerifyZkp', [id, zkp.claimId || 'unknown_claim'], {
          verified,
          enforceZkp: true,
          error: verificationError,
        });
        // 2. Attestation Check
        this.config.logGenerator.addEvent('CheckAttestation', [id], {
          hasEnclaveSignature: !!zkp.enclaveSignature,
          isAttestationValid: verified,
        });
      }

      if (!verified) {
        return {
          success: false,
          commandId: id,
          result: null,
          verdict: 'deny',
          receiptId: 'n/a',
          error: `ZKP Authorization failed: ${verificationError}`,
        };
      }
    } else {
      if (this.config.logGenerator) {
        this.config.logGenerator.addObject(zkp.claimId || 'unknown_claim', 'proof', {
          claimId: zkp.claimId,
          verified: true,
        });
        this.config.logGenerator.addEvent('VerifyZkp', [id, zkp.claimId || 'unknown_claim'], {
          verified: true,
          enforceZkp: false,
        });
        // 2. Attestation Check
        this.config.logGenerator.addEvent('CheckAttestation', [id], {
          hasEnclaveSignature: !!zkp.enclaveSignature,
          isAttestationValid: true,
        });
      }
    }

    // 3. Membrane Execution
    const executionBlock = async () => {
      return this.executeSemanticAction(action, this.deepClone(params));
    };

    const membraneResult = await this.membrane.run<T>(
      `agent-action:${action}`,
      id,
      this.deepClone(params),
      executionBlock
    );

    // 4. Receipt Bound
    if (this.config.logGenerator) {
      this.config.logGenerator.addObject(membraneResult.receipt.id, 'receipt', {
        receiptId: membraneResult.receipt.id,
        verdict: membraneResult.receipt.verdict,
      });
      this.config.logGenerator.addEvent('BindReceipt', [id, membraneResult.receipt.id], {
        success: membraneResult.success,
        verdict: membraneResult.receipt.verdict,
        error: membraneResult.error,
      });
    }

    return {
      success: membraneResult.success,
      commandId: id,
      result: this.deepClone(membraneResult.result),
      verdict: membraneResult.receipt.verdict,
      receiptId: membraneResult.receipt.id,
      error: membraneResult.error,
    };
  }

  /**
   * Helper to resolve dot-notated paths in state object.
   */
  private resolvePath(obj: any, path: string): any {
    const keys = this.sanitizePath(path);
    return keys.reduce((prev, curr) => {
      return prev ? prev[curr] : undefined;
    }, obj);
  }

  /**
   * Internal dispatcher for semantic actions.
   */
  protected async executeSemanticAction(action: string, params: Record<string, any>): Promise<any> {
    // INNOVATION: This is where we bridge semantic intent to runtime execution.
    // In the Pcp 2030 vision, this is driven by the ontology.

    // For now, we simulate a few common actions
    switch (action) {
      case 'update_state':
        const { path, value } = params;
        const keys = this.sanitizePath(path);
        const lastKey = keys.pop();
        const target = keys.reduce((prev: any, curr: string) => prev[curr], this.state);
        if (target && lastKey) {
          if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
            throw new Error(
              `Security Exception: Access to prototype-modifying keys is forbidden: ${path}`
            );
          }
          target[lastKey] = this.deepClone(value);
          return { status: 'updated', path, value: this.deepClone(value) };
        }
        throw new Error(`Target path not found: ${path}`);

      case 'ping':
        return {
          pong: true,
          timestamp: Date.now(),
          version: '2030.1.1-ultimate',
        };

      default:
        return { status: 'acknowledged', action, params };
    }
  }
}
