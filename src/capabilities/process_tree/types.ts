export type ProcessTreeOperator = 
    | "Sequence"
    | "ExclusiveChoice"
    | "Parallel"
    | "Loop"
    | "InclusiveChoice"
    | "Interleaved";

export type ProcessTreeRefusal =
    | "EmptyTree"
    | "InvalidOperator"
    | "InvalidChildCount"
    | "UnreachableState";

export type ProcessTreeNode =
    | { type: "Operator"; id: string; operator: ProcessTreeOperator; children: ProcessTreeNode[] }
    | { type: "Activity"; id: string; activity: string }
    | { type: "Silent"; id: string };

export interface ProcessTree {
    id: string;
    root: ProcessTreeNode;
}

export type Result<T, E> = 
    | { success: true; value: T }
    | { success: false; error: E };
