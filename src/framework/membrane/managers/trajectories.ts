export class TrajectoryManager {
  private flows: Record<string, Record<string, string[]>> = {};

  public registerFlow(flowName: string, allowedTransitions: Record<string, string[]>) {
    this.flows[flowName] = allowedTransitions;
  }

  public validateTransition(flowName: string, fromState: string, toState: string): boolean {
    const flow = this.flows[flowName];
    if (!flow) return false;

    const allowed = flow[fromState];
    if (!allowed) return false;

    return allowed.includes(toState);
  }

  public getFlow(flowName: string): Record<string, string[]> | undefined {
    return this.flows[flowName];
  }
}
