export class Trajectories {
  private static flows: Record<string, Record<string, string[]>> = {
    SermonFlow: {
      idle: ['drafted'],
      drafted: ['reviewed'],
      reviewed: ['published'],
      published: []
    },
    OrderFlow: {
      idle: ['cart_updated'],
      cart_updated: ['address_added'],
      address_added: ['processing'],
      processing: ['completed'],
      completed: []
    },
    VolunteerFlow: {
      idle: ['applied'],
      applied: ['interviewed', 'idle'],
      interviewed: ['approved', 'rejected'],
      approved: [],
      rejected: []
    }
  };

  /**
   * Validate if a transition from `fromState` to `toState` is allowed in the flow
   */
  static validateTransition(flowName: string, fromState: string, toState: string): boolean {
    const flow = this.flows[flowName];
    if (!flow) return false;

    const allowed = flow[fromState];
    if (!allowed) return false;

    return allowed.includes(toState);
  }
}
