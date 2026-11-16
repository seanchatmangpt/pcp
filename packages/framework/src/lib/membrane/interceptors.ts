import { InterceptorContext, AdmissibilityVerdict, InterceptorFunction } from './types';

export class Interceptors {
  private static chain: InterceptorFunction[] = [];

  static register(interceptor: InterceptorFunction) {
    this.chain.push(interceptor);
  }

  static clear() {
    this.chain = [];
  }

  /**
   * Evaluates input context across the interceptor chain:
   * - any interceptor returning false -> 'deny'
   * - any interceptor returning true -> 'fork'
   * - all returning undefined -> 'allow'
   */
  static async evaluate(ctx: InterceptorContext): Promise<AdmissibilityVerdict> {
    // Default interceptor 1: Authority guard
    const authInterceptor: InterceptorFunction = async (c) => {
      const allowedRoles = ['admin', 'pastor', 'volunteer'];
      if (!allowedRoles.includes(c.config.authorityRole)) {
        return false; // Deny unauthorized
      }
      return undefined; // Observe/validate
    };

    // Default interceptor 2: Speculative simulation tag
    const simInterceptor: InterceptorFunction = async (c) => {
      if (c.input.__speculative === true) {
        return true; // Override to fork/simulate
      }
      return undefined;
    };

    const activeChain = [authInterceptor, simInterceptor, ...this.chain];

    let hasFork = false;

    for (const intercept of activeChain) {
      const result = await intercept(ctx);
      if (result === false) {
        return 'deny';
      }
      if (result === true) {
        hasFork = true;
      }
    }

    return hasFork ? 'fork' : 'allow';
  }
}
