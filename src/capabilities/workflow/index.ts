export type WorkflowBranchState = "Pending" | "Running" | "Completed" | "Canceled";

export interface BranchToken {
  branch_id: string;
  state: WorkflowBranchState;
}

export interface ParallelWorkflow {
  workflow_id: string;
  branches: BranchToken[];
}

export type WorkflowRefusal = 
  | "InvalidJoinPoint" 
  | "MissingStartBranch" 
  | "DuplicateBranchToken";

export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export interface WorkflowAction {
  type: "START_BRANCH" | "COMPLETE_BRANCH" | "CANCEL_BRANCH" | "JOIN_BRANCHES";
  branch_id?: string;
  branch_ids?: string[];
}

export class WorkflowEngine {
  /**
   * Validates the structural integrity of a ParallelWorkflow
   */
  public validate(workflow: Partial<ParallelWorkflow>): Result<ParallelWorkflow, WorkflowRefusal> {
    if (!workflow.workflow_id) {
      return { ok: false, error: "MissingStartBranch" };
    }

    const branches = workflow.branches || [];
    
    if (branches.length === 0) {
      return { ok: false, error: "MissingStartBranch" };
    }

    const seen = new Set<string>();
    for (const b of branches) {
      if (seen.has(b.branch_id)) {
        return { ok: false, error: "DuplicateBranchToken" };
      }
      seen.add(b.branch_id);
    }

    return {
      ok: true,
      value: {
        workflow_id: workflow.workflow_id,
        branches: branches,
      }
    };
  }

  /**
   * Executes a workflow action and returns the new workflow state
   */
  public executeAction(
    workflow: ParallelWorkflow, 
    action: WorkflowAction
  ): Result<ParallelWorkflow, WorkflowRefusal> {
    const branches = [...workflow.branches];

    switch (action.type) {
      case "START_BRANCH": {
        if (!action.branch_id) {
          return { ok: false, error: "MissingStartBranch" };
        }
        if (branches.find(b => b.branch_id === action.branch_id)) {
          return { ok: false, error: "DuplicateBranchToken" };
        }
        branches.push({ branch_id: action.branch_id, state: "Running" });
        break;
      }
      
      case "COMPLETE_BRANCH": {
        if (!action.branch_id) {
          return { ok: false, error: "InvalidJoinPoint" };
        }
        const idx = branches.findIndex(b => b.branch_id === action.branch_id);
        if (idx === -1) {
          return { ok: false, error: "InvalidJoinPoint" };
        }
        
        // Cannot complete a canceled branch
        if (branches[idx].state === "Canceled") {
            return { ok: false, error: "InvalidJoinPoint" };
        }

        branches[idx] = { ...branches[idx], state: "Completed" };
        break;
      }
      
      case "CANCEL_BRANCH": {
        if (!action.branch_id) {
          return { ok: false, error: "InvalidJoinPoint" };
        }
        const idx = branches.findIndex(b => b.branch_id === action.branch_id);
        if (idx === -1) {
          return { ok: false, error: "InvalidJoinPoint" };
        }
        branches[idx] = { ...branches[idx], state: "Canceled" };
        break;
      }
      
      case "JOIN_BRANCHES": {
        if (!action.branch_ids || action.branch_ids.length === 0) {
          return { ok: false, error: "InvalidJoinPoint" };
        }
        
        // All branches to join must exist and be in a terminal state
        for (const bid of action.branch_ids) {
          const b = branches.find(branch => branch.branch_id === bid);
          if (!b || (b.state !== "Completed" && b.state !== "Canceled")) {
            return { ok: false, error: "InvalidJoinPoint" };
          }
        }
        
        // Remove joined branches from the active state, as they have been consumed
        for (const bid of action.branch_ids) {
          const idx = branches.findIndex(branch => branch.branch_id === bid);
          if (idx !== -1) {
            branches.splice(idx, 1);
          }
        }
        
        break;
      }
      
      default: {
        const _exhaustiveCheck: never = action.type as never;
        return { ok: false, error: "InvalidJoinPoint" };
      }
    }

    return {
      ok: true,
      value: {
        workflow_id: workflow.workflow_id,
        branches
      }
    };
  }
}
