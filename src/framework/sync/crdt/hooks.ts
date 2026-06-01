import { useState, useCallback, useMemo, useEffect } from 'react';
import { CRDT, LWWRegisterState, PNCounterState, LWWMapState } from './types';

/**
 * Hook to manage CRDT state in a React component.
 * Provides the current value and a way to update it.
 */
export function useCrdtState<TState, TDelta, TCRDT extends CRDT<TState, TDelta>, TValue>(
  factory: (peerId: string, initialState?: TState) => TCRDT,
  peerId: string,
  initialState?: TState,
  getValue?: (crdt: TCRDT) => TValue
): [TValue, TCRDT, (other: TState | TDelta) => void, () => void] {
  const crdt = useMemo(() => factory(peerId, initialState), [peerId, initialState]);
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo(
    () => (getValue ? getValue(crdt) : ((crdt as any).value as TValue)),
    [crdt, tick, getValue]
  );

  const merge = useCallback(
    (other: TState | TDelta) => {
      crdt.merge(other);
      forceUpdate();
    },
    [crdt, forceUpdate]
  );

  return [value, crdt, merge, forceUpdate];
}

/**
 * Specialized hook for LWWRegister.
 */
import { LWWRegister } from './register';

export function useLWWRegister<T>(
  peerId: string,
  initialValue: T
): [T, (val: T) => void, (state: LWWRegisterState<T>) => void] {
  const [value, crdt, merge, forceUpdate] = useCrdtState<
    LWWRegisterState<T>,
    LWWRegisterState<T>,
    LWWRegister<T>,
    T
  >(
    (pid, initial) => new LWWRegister(pid, initial?.value ?? initialValue, initial?.timestamp),
    peerId,
    undefined,
    (c) => c.value
  );

  const [localValue, setLocalValue] = useState(value);

  // Update local value when CRDT value changes (e.g. via merge)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const setValue = useCallback(
    (val: T) => {
      crdt.set(val);
      setLocalValue(crdt.value);
      forceUpdate();
    },
    [crdt, forceUpdate]
  );

  return [localValue, setValue, merge];
}

/**
 * Specialized hook for PNCounter.
 */
import { PNCounter } from './counter';

export function usePNCounter(
  peerId: string,
  initialValue: number = 0
): [
  number,
  { increment: (amt?: number) => void; decrement: (amt?: number) => void },
  (state: PNCounterState) => void,
] {
  const [value, crdt, merge, forceUpdate] = useCrdtState<
    PNCounterState,
    PNCounterState,
    PNCounter,
    number
  >(
    (pid) => new PNCounter(pid),
    peerId,
    undefined,
    (c) => c.value
  );

  const ops = useMemo(
    () => ({
      increment: (amt?: number) => {
        crdt.increment(amt);
        forceUpdate();
      },
      decrement: (amt?: number) => {
        crdt.decrement(amt);
        forceUpdate();
      },
    }),
    [crdt, forceUpdate]
  );

  return [value, ops, merge];
}

/**
 * Specialized hook for LWWMap.
 */
import { LWWMap } from './map';

export function useLWWMap<V>(
  peerId: string,
  initialState: LWWMapState<V> = {}
): [
  LWWMapState<V>,
  {
    set: (key: string, val: V) => void;
    delete: (key: string) => void;
    get: (key: string) => V | undefined;
  },
  (state: LWWMapState<V>) => void,
] {
  const [state, crdt, merge, forceUpdate] = useCrdtState<
    LWWMapState<V>,
    LWWMapState<V>,
    LWWMap<V>,
    LWWMapState<V>
  >(
    (pid, initial) => new LWWMap(pid, initial ?? initialState),
    peerId,
    undefined,
    (c) => c.state
  );

  const ops = useMemo(
    () => ({
      set: (key: string, val: V) => {
        crdt.set(key, val);
        forceUpdate();
      },
      delete: (key: string) => {
        crdt.delete(key);
        forceUpdate();
      },
      get: (key: string) => crdt.get(key),
    }),
    [crdt, forceUpdate]
  );

  return [state, ops, merge];
}
