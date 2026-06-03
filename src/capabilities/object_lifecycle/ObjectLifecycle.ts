import {
    ObjectState,
    LifecycleRefusal,
    LifecycleRefusalType,
    Transition,
    Result
} from './types';

export class ObjectLifecycle {
    private readonly objectId: string;
    private readonly objectType: string;
    private readonly states: Map<string, ObjectState>;
    private readonly allowedTransitions: Map<string, Set<string>>; // fromStateId -> Set<toStateId>
    private readonly refusals: Map<string, LifecycleRefusal>;
    private currentStateId: string | null;
    private readonly history: Array<{ timestamp: number, stateId: string, trigger?: string }>;

    constructor(objectId: string, objectType: string) {
        if (!objectId) throw new Error("ObjectLifecycle requires a valid objectId.");
        if (!objectType) throw new Error("ObjectLifecycle requires a valid objectType.");

        this.objectId = objectId;
        this.objectType = objectType;
        this.states = new Map();
        this.allowedTransitions = new Map();
        this.refusals = new Map();
        this.currentStateId = null;
        this.history = [];
    }

    public getObjectId(): string {
        return this.objectId;
    }

    public getObjectType(): string {
        return this.objectType;
    }

    public getCurrentState(): ObjectState | null {
        if (!this.currentStateId) return null;
        return this.getState(this.currentStateId) || null;
    }

    public registerState(state: ObjectState): void {
        if (this.states.has(state.id)) {
            throw new Error(`State with id ${state.id} is already registered.`);
        }
        if (!state.name) {
            throw new Error(`State with id ${state.id} is missing a valid name.`);
        }
        
        this.states.set(state.id, { ...state, metadata: { ...state.metadata } });
        
        if (!this.allowedTransitions.has(state.id)) {
            this.allowedTransitions.set(state.id, new Set());
        }
    }

    public getState(id: string): ObjectState | undefined {
        const state = this.states.get(id);
        if (!state) return undefined;
        return { ...state, metadata: { ...state.metadata } };
    }

    public getAllStates(): ObjectState[] {
        return Array.from(this.states.values()).map(s => ({
            ...s,
            metadata: { ...s.metadata }
        }));
    }

    public registerTransition(transition: Transition): void {
        if (!this.states.has(transition.fromStateId)) {
            throw new Error(`fromStateId ${transition.fromStateId} is not registered.`);
        }
        if (!this.states.has(transition.toStateId)) {
            throw new Error(`toStateId ${transition.toStateId} is not registered.`);
        }

        const allowed = this.allowedTransitions.get(transition.fromStateId);
        if (allowed) {
            allowed.add(transition.toStateId);
        }
    }

    public getTransitionsFrom(stateId: string): string[] {
        const allowed = this.allowedTransitions.get(stateId);
        return allowed ? Array.from(allowed) : [];
    }

    private createRefusal(
        refusalType: LifecycleRefusalType,
        message: string,
        details: Record<string, unknown> | null = null
    ): LifecycleRefusal {
        const refusal: LifecycleRefusal = {
            id: `refusal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            objectId: this.objectId,
            refusalType,
            message,
            details,
            timestamp: Date.now()
        };
        this.refusals.set(refusal.id, refusal);
        return refusal;
    }

    public initialize(stateId: string, timestamp: number = Date.now()): Result<ObjectState, LifecycleRefusal> {
        const state = this.states.get(stateId);
        if (!state) {
            return {
                ok: false,
                error: this.createRefusal("StateNotFound", `Cannot initialize with unknown state ${stateId}`)
            };
        }

        if (state.phase !== "Initial") {
            return {
                ok: false,
                error: this.createRefusal("IllegalInitialState", `State ${stateId} is not an initial state phase.`)
            };
        }

        if (this.currentStateId !== null) {
            return {
                ok: false,
                error: this.createRefusal("IllegalInitialState", "Lifecycle is already initialized.")
            };
        }

        this.currentStateId = state.id;
        this.history.push({ timestamp, stateId: state.id, trigger: "INITIALIZE" });

        return { ok: true, value: this.getState(state.id)! };
    }

    public transition(toStateId: string, trigger?: string, timestamp: number = Date.now()): Result<ObjectState, LifecycleRefusal> {
        if (this.currentStateId === null) {
            return {
                ok: false,
                error: this.createRefusal("MissingInitialState", "Cannot transition, lifecycle is not initialized.")
            };
        }

        const currentState = this.states.get(this.currentStateId);
        if (!currentState) {
            return {
                ok: false,
                error: this.createRefusal("StateNotFound", `Current state ${this.currentStateId} no longer exists.`)
            };
        }

        if (currentState.phase === "Terminal") {
            return {
                ok: false,
                error: this.createRefusal("AlreadyInTerminalState", `Object is in a terminal state (${this.currentStateId}) and cannot transition.`)
            };
        }

        const targetState = this.states.get(toStateId);
        if (!targetState) {
            return {
                ok: false,
                error: this.createRefusal("StateNotFound", `Target state ${toStateId} is not registered.`)
            };
        }

        const allowed = this.allowedTransitions.get(this.currentStateId);
        if (!allowed || !allowed.has(toStateId)) {
            return {
                ok: false,
                error: this.createRefusal("InvalidTransition", `Transition from ${this.currentStateId} to ${toStateId} is not allowed.`, {
                    from: this.currentStateId,
                    to: toStateId,
                    trigger
                })
            };
        }

        this.currentStateId = targetState.id;
        this.history.push({ timestamp, stateId: targetState.id, trigger });

        return { ok: true, value: this.getState(targetState.id)! };
    }

    public getHistory(): Array<{ timestamp: number, stateId: string, trigger?: string }> {
        return [...this.history];
    }

    public getAllRefusals(): LifecycleRefusal[] {
        return Array.from(this.refusals.values());
    }

    public isTerminated(): boolean {
        if (!this.currentStateId) return false;
        const current = this.states.get(this.currentStateId);
        return current ? current.phase === "Terminal" : false;
    }
}
