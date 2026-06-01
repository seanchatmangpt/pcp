import { InterceptorFunction, InterceptorContext, AdmissibilityVerdict } from '../types';

export class InterceptorManager {
  private chain: InterceptorFunction[] = [];

  public register(interceptor: InterceptorFunction) {
    this.chain.push(interceptor);
  }

  public clear() {
    this.chain = [];
  }

  public async evaluate(ctx: InterceptorContext): Promise<AdmissibilityVerdict> {
    let hasFork = false;

    for (const intercept of this.chain) {
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
