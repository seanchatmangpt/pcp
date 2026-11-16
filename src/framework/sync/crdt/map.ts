import { CRDT, LWWMapState, LWWRegisterState } from './types';
import { LWWRegister } from './register';

/**
 * Last-Write-Wins (LWW) Map.
 * A map of keys to LWWRegisters.
 */
export class LWWMap<V> implements CRDT<LWWMapState<V>, LWWMapState<V>> {
  private _registers: Map<string, LWWRegister<V>> = new Map();
  private _tombstones: Map<string, LWWRegister<null>> = new Map();
  private _peerId: string;

  constructor(peerId: string, initialState: LWWMapState<V> = {}) {
    this._peerId = peerId;
    this.merge(initialState);
  }

  get state(): LWWMapState<V> {
    const state: LWWMapState<V> = {};
    const allKeys = new Set([...this._registers.keys(), ...this._tombstones.keys()]);
    
    for (const key of allKeys) {
      const reg = this._registers.get(key);
      const tomb = this._tombstones.get(key);

      if (!tomb) {
        state[key] = reg!.state;
      } else if (!reg) {
        state[key] = { ...tomb.state, deleted: true } as any;
      } else {
        // Tie-break: highest timestamp wins, then highest peerId, then tombstone wins ties
        const regState = reg.state;
        const tombState = tomb.state;

        if (tombState.timestamp > regState.timestamp) {
          state[key] = { ...tombState, deleted: true } as any;
        } else if (regState.timestamp > tombState.timestamp) {
          state[key] = regState;
        } else {
          // Timestamps are equal, use peerId
          if (tombState.peerId > regState.peerId) {
            state[key] = { ...tombState, deleted: true } as any;
          } else if (regState.peerId > tombState.peerId) {
            state[key] = regState;
          } else {
            // Everything equal, tombstone wins
            state[key] = { ...tombState, deleted: true } as any;
          }
        }
      }
    }
    return state;
  }

  get(key: string): V | undefined {
    const reg = this._registers.get(key);
    if (!reg) return undefined;

    const tomb = this._tombstones.get(key);
    if (tomb) {
      const regState = reg.state;
      const tombState = tomb.state;

      // Same logic as in state getter
      if (tombState.timestamp > regState.timestamp) return undefined;
      if (tombState.timestamp === regState.timestamp) {
        if (tombState.peerId >= regState.peerId) return undefined;
      }
    }

    return reg.value;
  }

  set(key: string, value: V): void {
    const reg = this._registers.get(key);
    const tomb = this._tombstones.get(key);
    
    // Ensure new timestamp is higher than any existing state for this key
    let timestamp = Date.now();
    if (reg) timestamp = Math.max(timestamp, reg.state.timestamp + 1);
    if (tomb) timestamp = Math.max(timestamp, tomb.state.timestamp + 1);

    if (reg) {
      reg.set(value, timestamp);
    } else {
      this._registers.set(key, new LWWRegister(this._peerId, value, timestamp));
    }
  }

  delete(key: string): void {
    const reg = this._registers.get(key);
    const tomb = this._tombstones.get(key);
    
    // Ensure new timestamp is higher than any existing state for this key
    let timestamp = Date.now();
    if (reg) timestamp = Math.max(timestamp, reg.state.timestamp + 1);
    if (tomb) timestamp = Math.max(timestamp, tomb.state.timestamp + 1);

    if (tomb) {
      tomb.set(null, timestamp);
    } else {
      this._tombstones.set(key, new LWWRegister(this._peerId, null, timestamp));
    }
  }

  merge(other: LWWMapState<V>): void {
    for (const [key, regState] of Object.entries(other)) {
      const otherRegState = regState as LWWRegisterState<V> & { deleted?: boolean };
      
      if (otherRegState.deleted) {
        const tomb = this._tombstones.get(key);
        if (tomb) {
          tomb.merge(otherRegState as any);
        } else {
          this._tombstones.set(
            key,
            new LWWRegister(otherRegState.peerId, null, otherRegState.timestamp)
          );
        }
      } else {
        const reg = this._registers.get(key);
        if (reg) {
          reg.merge(otherRegState);
        } else {
          this._registers.set(
            key,
            new LWWRegister(otherRegState.peerId, otherRegState.value, otherRegState.timestamp)
          );
        }
      }
    }
  }

  toJSON(): LWWMapState<V> {
    return this.state;
  }
}
