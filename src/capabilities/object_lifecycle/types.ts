export type LifecycleRefusalType = 
    | "ObjectNotFound"
    | "StateNotFound"
    | "InvalidTransition"
    | "AlreadyInTerminalState"
    | "IllegalInitialState"
    | "DuplicateState"
    | "MissingInitialState";

export interface LifecycleRefusal {
    id: string;
    objectId: string;
    refusalType: LifecycleRefusalType;
    message: string;
    details: Record<string, unknown> | null;
    timestamp: number;
}

export type StatePhase = "Initial" | "Active" | "Terminal";

export interface ObjectState {
    id: string;
    name: string;
    phase: StatePhase;
    metadata: Record<string, unknown>;
}

export interface Transition {
    id: string;
    fromStateId: string;
    toStateId: string;
    trigger?: string;
}

export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };
