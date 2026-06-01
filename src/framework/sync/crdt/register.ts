import { CRDT, LWWRegisterState } from './types';

/**
 * Last-Write-Wins (LWW) Register.
 * The value with the highest timestamp wins.
 * If timestamps are equal, the peerId is used as a tie-breaker.
 */
export class LWWRegister<T> implements CRDT<LWWRegisterState<T>, LWWRegisterState<T>> {
  private _state: LWWRegisterState<T>;

  constructor(peerId: string, initialValue: T, timestamp: number = Date.now()) {
    this._state = {
      value: initialValue,
      timestamp,
      peerId,
    };
  }

  get state(): LWWRegisterState<T> {
    return { ...this._state };
  }

  get value(): T {
    return this._state.value;
  }

  set value(newValue: T) {
    this.set(newValue);
  }

  /**
   * Sets a new value with a new timestamp.
   */
  set(value: T, timestamp: number = Date.now()): void {
    // Ensure monotonicity: timestamp must be at least one greater than the current one
    // to ensure local changes always "win" over their own previous state.
    const finalTimestamp = Math.max(timestamp, this._state.timestamp + 1);

    this._state = {
      ...this._state,
      value,
      timestamp: finalTimestamp,
    };
  }

  /**
   * Merges another register's state into this one.
   */
  merge(other: LWWRegisterState<T>): void {
    if (other.timestamp > this._state.timestamp) {
      this._state = { ...other };
    } else if (other.timestamp === this._state.timestamp) {
      if (other.peerId > this._state.peerId) {
        this._state = { ...other };
      }
    }
  }

  toJSON(): LWWRegisterState<T> {
    return this.state;
  }
}
