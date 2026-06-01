import { CRDT, LWWMapState, LWWRegisterState } from './types';
import { LWWRegister } from './register';

/**
 * Last-Write-Wins (LWW) Map.
 * A map of keys to LWWRegisters.
 */
export class LWWMap<V> implements CRDT<LWWMapState<V>, LWWMapState<V>> {
  private _registers: Map<string, LWWRegister<V>> = new Map();
  private _peerId: string;

  constructor(peerId: string, initialState: LWWMapState<V> = {}) {
    this._peerId = peerId;
    for (const [key, regState] of Object.entries(initialState)) {
      this._registers.set(
        key,
        new LWWRegister(regState.peerId, regState.value, regState.timestamp)
      );
    }
  }

  get state(): LWWMapState<V> {
    const state: LWWMapState<V> = {};
    for (const [key, reg] of this._registers.entries()) {
      state[key] = reg.state;
    }
    return state;
  }

  get(key: string): V | undefined {
    return this._registers.get(key)?.value;
  }

  set(key: string, value: V): void {
    const reg = this._registers.get(key);
    if (reg) {
      reg.set(value);
    } else {
      this._registers.set(key, new LWWRegister(this._peerId, value));
    }
  }

  delete(key: string): void {
    // In a true CRDT map, deletion is often handled with tombstones.
    // For this simple LWWMap, we'll just set it to undefined if V allows it,
    // or we'd need an LWWSet to track deletions.
    // To keep it "generic" and simple, we'll use a null value as a tombstone if needed,
    // or just not support true deletion in this specific class for now,
    // OR we can use an internal LWWRegister with a special value.

    // Improved approach: Each entry is a register. To "delete", we could have a flag.
    // For now, let's stick to simple LWW of values.
    this._registers.delete(key);
  }

  merge(other: LWWMapState<V>): void {
    for (const [key, regState] of Object.entries(other)) {
      const reg = this._registers.get(key);
      if (reg) {
        reg.merge(regState);
      } else {
        this._registers.set(
          key,
          new LWWRegister(regState.peerId, regState.value, regState.timestamp)
        );
      }
    }
  }

  toJSON(): LWWMapState<V> {
    return this.state;
  }
}
