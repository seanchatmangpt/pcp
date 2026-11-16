import { CRDT, GCounterState, PNCounterState } from './types';

/**
 * G-Counter (Grow-only Counter).
 * Each peer has its own counter.
 * Merging takes the maximum of each peer's counter.
 */
export class GCounter implements CRDT<GCounterState, GCounterState> {
  private _state: GCounterState = {};
  private _peerId: string;

  constructor(peerId: string, initialState: GCounterState = {}) {
    this._peerId = peerId;
    this._state = { ...initialState };
    if (!this._state[this._peerId]) {
      this._state[this._peerId] = 0;
    }
  }

  get state(): GCounterState {
    return { ...this._state };
  }

  get value(): number {
    return Object.values(this._state).reduce((a, b) => a + b, 0);
  }

  increment(amount: number = 1): void {
    if (amount < 0) throw new Error('GCounter can only be incremented by positive amounts');
    this._state[this._peerId] = (this._state[this._peerId] || 0) + amount;
  }

  merge(other: GCounterState): void {
    for (const [peerId, value] of Object.entries(other)) {
      this._state[peerId] = Math.max(this._state[peerId] || 0, value);
    }
  }

  toJSON(): GCounterState {
    return this.state;
  }
}

/**
 * PN-Counter (Positive-Negative Counter).
 * Uses two G-Counters: one for increments and one for decrements.
 */
export class PNCounter implements CRDT<PNCounterState, PNCounterState> {
  private p: GCounter;
  private n: GCounter;

  constructor(peerId: string, initialState?: PNCounterState) {
    this.p = new GCounter(peerId, initialState?.p || {});
    this.n = new GCounter(peerId, initialState?.n || {});
  }

  get state(): PNCounterState {
    return {
      p: this.p.state,
      n: this.n.state,
    };
  }

  get value(): number {
    return this.p.value - this.n.value;
  }

  increment(amount: number = 1): void {
    this.p.increment(amount);
  }

  decrement(amount: number = 1): void {
    this.n.increment(amount);
  }

  merge(other: PNCounterState): void {
    this.p.merge(other.p);
    this.n.merge(other.n);
  }

  toJSON(): PNCounterState {
    return this.state;
  }
}
