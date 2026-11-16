import { CRDT, LWWRegisterState } from './types';

/**
 * Extended state for LWWRegister with Lamport clock for Byzantine Hijacking mitigation.
 */
export interface LamportLWWRegisterState<T> extends LWWRegisterState<T> {
  counter: number;
}

/**
 * Last-Write-Wins (LWW) Register with Lamport clock mitigation.
 * The value with the highest timestamp wins.
 * If timestamps are equal, the counter is used as a secondary tie-breaker.
 * If counters are also equal, the peerId is used as a final deterministic tie-breaker.
 */
export class LWWRegister<T> implements CRDT<LWWRegisterState<T>, LWWRegisterState<T>> {
  private _state: LamportLWWRegisterState<T>;

  constructor(peerId: string, initialValue: T, timestamp: number = Date.now(), counter: number = 0) {
    this._state = {
      value: initialValue,
      timestamp,
      peerId,
      counter,
    };
  }

  get state(): LWWRegisterState<T> {
    // We return the full state including counter. Consumers can cast to LamportLWWRegisterState if needed.
    return { ...this._state };
  }

  get value(): T {
    return this._state.value;
  }

  set value(newValue: T) {
    this.set(newValue);
  }

  /**
   * Sets a new value with a new timestamp and increments the Lamport counter if needed.
   * This ensures that local updates always have a path to "win" even against future-timestamp spoofing
   * by maintaining monotonicity and using the counter as a tie-breaker.
   */
  set(value: T, timestamp: number = Date.now()): void {
    const lastTimestamp = this._state.timestamp;
    const lastCounter = this._state.counter;

    // Ensure monotonicity: never move backwards in time.
    const finalTimestamp = Math.max(timestamp, lastTimestamp);
    
    // If we are at the same timestamp, increment the counter to ensure this update wins over the previous state.
    // If we moved forward in time, we can reset the counter to 0.
    const finalCounter = (finalTimestamp === lastTimestamp) ? lastCounter + 1 : 0;

    this._state = {
      ...this._state,
      value,
      timestamp: finalTimestamp,
      counter: finalCounter,
    };
  }

  /**
   * Merges another register's state into this one using (timestamp, counter, peerId) order.
   */
  merge(other: LWWRegisterState<T>): void {
    const remote = other as LamportLWWRegisterState<T>;
    const remoteCounter = remote.counter ?? 0;
    const localCounter = this._state.counter;

    const remoteWins = 
      (other.timestamp > this._state.timestamp) ||
      (other.timestamp === this._state.timestamp && remoteCounter > localCounter) ||
      (other.timestamp === this._state.timestamp && remoteCounter === localCounter && other.peerId > this._state.peerId);

    if (remoteWins) {
      this._state = {
        value: other.value,
        timestamp: other.timestamp,
        peerId: other.peerId,
        counter: remoteCounter,
      };
    }
  }

  toJSON(): LWWRegisterState<T> {
    return this.state;
  }
}
