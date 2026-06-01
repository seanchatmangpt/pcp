import { Membrane } from '../../../membrane/membrane';
import { InterceptorContext } from '../../../membrane/types';

export class AdversarialCodeMutator {
  private membrane: Membrane;

  constructor(membrane: Membrane) {
    this.membrane = membrane;
  }

  /**
   * Attempts Prototype Pollution by sending an un-sanitized __proto__ payload
   */
  public async attackPrototypePollution(
    commandId: string,
    targetPath: string = '__proto__.polluted'
  ) {
    const payload = this.buildPollutionPayload(targetPath, 'true');
    return this.membrane.run('capability_mutate', commandId, payload, async () => {
      const target = {};
      this.naiveMerge(target, payload);
      return target;
    });
  }

  /**
   * Attempts an AST Injection by sending unexpected nodes like CallExpression into a limited evaluator
   */
  public async attackASTInjection(commandId: string, maliciousNode: any) {
    const payload = {
      ast: {
        type: 'Program',
        body: [maliciousNode],
      },
    };
    return this.membrane.run('capability_mutate', commandId, payload, async () => {
      // Simulate vulnerable evaluator
      if (payload.ast.body[0].type === 'CallExpression') {
        throw new Error('Fatal AST Evaluation: CallExpression not permitted');
      }
      return { compiled: true };
    });
  }

  /**
   * Attempts Type-Law Violation by sending an illegal state transition payload
   */
  public async attackTypeLawViolation(
    commandId: string,
    flowName: string,
    fromState: string,
    toState: string
  ) {
    const payload = {
      flowName,
      fromState,
      toState,
      data: { illegalMutation: true },
    };
    return this.membrane.run('capability_mutate', commandId, payload, async () => {
      return { updated: true, state: toState };
    });
  }

  /**
   * Generates a nested payload to target a specific property path
   */
  private buildPollutionPayload(path: string, value: any): any {
    const parts = path.split('.');
    let jsonStr = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
    for (let i = parts.length - 1; i >= 0; i--) {
      jsonStr = `{"${parts[i]}": ${jsonStr}}`;
    }
    return JSON.parse(jsonStr);
  }

  /**
   * Vulnerable merge function meant to be executed inside the membrane
   */
  private naiveMerge(target: any, source: any) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          target[key] = target[key] || {};
          this.naiveMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }
}

// Built-in Interceptors for the testing rig to prove isolation
export const PrototypePollutionDefender = async (ctx: InterceptorContext) => {
  const check = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return true;
    for (const key in obj) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
      if (!check(obj[key])) return false;
    }
    return true;
  };
  if (!check(ctx.input)) return false;
  return true;
};

export const ASTInjectionDefender = async (ctx: InterceptorContext) => {
  const check = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return true;
    if (obj.type === 'CallExpression' || obj.type === 'MaliciousExpression') return false;
    for (const key in obj) {
      if (!check(obj[key])) return false;
    }
    return true;
  };
  if (!check(ctx.input)) return false;
  return true;
};
