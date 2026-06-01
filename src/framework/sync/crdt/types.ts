/**
 * Base interface for all CRDT types.
 */
export interface CRDT<TState, TDelta> {
  /**
   * Current state of the CRDT.
   */
  readonly state: TState;

  /**
   * Merges another CRDT's state or a delta into the current state.
   */
  merge(other: TState | TDelta): void;

  /**
   * Returns a JSON-serializable representation of the state.
   */
  toJSON(): TState;
}

/**
 * Interface for CRDTs that support delta-based replication.
 */
export interface DeltaCRDT<TState, TDelta> extends CRDT<TState, TDelta> {
  /**
   * Generates a delta since the last sync.
   */
  generateDelta(): TDelta | null;

  /**
   * Resets the delta tracking.
   */
  resetDelta(): void;
}

/**
 * Last-Write-Wins Register state.
 */
export interface LWWRegisterState<T> {
  value: T;
  timestamp: number;
  peerId: string;
}

/**
 * G-Counter (Grow-only Counter) state.
 */
export type GCounterState = Record<string, number>;

/**
 * PN-Counter (Positive-Negative Counter) state.
 */
export interface PNCounterState {
  p: GCounterState;
  n: GCounterState;
}

/**
 * LWW-Element-Set state.
 */
export interface LWWSetState<T> {
  add: Record<string, { value: T; timestamp: number }>;
  remove: Record<string, { value: T; timestamp: number }>;
}

/**
 * LWW-Map state.
 */
export type LWWMapState<V> = Record<string, LWWRegisterState<V>>;

/**
 * Generic CRDT Metadata.
 */
export interface CrdtMetadata {
  peerId: string;
  logicalClock: number;
}
