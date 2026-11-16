import React, { useState, useEffect, useCallback, ReactNode } from 'react';

export type Probability = number;

export interface QuantumEntity<T> {
  value: T;
  probability: Probability;
}

export type Superposition<T> = QuantumEntity<T>[];

export interface QuantumStateReturn<T> {
  /** The uncollapsed superposition containing all possible realities */
  superposition: Superposition<T>;
  /** Attempts to access the deterministic value. Throws if not yet observed. */
  getDeterministicValue: () => T;
  /** Indicates if the wave function has collapsed to a singular reality */
  isCollapsed: boolean;
  /** Forcibly collapses the wave function into a single state based on probability mass */
  collapse: () => T;
  /** Mutates the quantum state, splitting reality again */
  setSuperposition: (newSuperposition: Superposition<T>) => void;
}

export class WaveFunctionCollapseError extends Error {
  constructor() {
    super(
      'Wave function has not yet collapsed. Cannot observe deterministic value without an Observer.'
    );
    this.name = 'WaveFunctionCollapseError';
  }
}

export class ZeroProbabilityError extends Error {
  constructor() {
    super('Total probability mass of superposition is zero. Cannot collapse into the void.');
    this.name = 'ZeroProbabilityError';
  }
}

/**
 * useQuantumState
 * A non-Euclidean state primitive that holds multiple conflicting values in superposition.
 */
export function useQuantumState<T>(initialSuperposition: Superposition<T>): QuantumStateReturn<T> {
  const [superposition, setSuperposition] = useState<Superposition<T>>(initialSuperposition);
  const [collapsedValue, setCollapsedValue] = useState<{ value: T } | null>(null);

  const collapse = useCallback(() => {
    if (superposition.length === 0) {
      throw new ZeroProbabilityError();
    }

    // Allow non-Euclidean negative probabilities by using absolute mass for collapse
    const totalMass = superposition.reduce((acc, curr) => acc + Math.abs(curr.probability), 0);

    if (totalMass === 0) {
      throw new ZeroProbabilityError();
    }

    let randomVal = Math.random() * totalMass;
    let selectedValue = superposition[0].value;

    for (const entity of superposition) {
      randomVal -= Math.abs(entity.probability);
      if (randomVal <= 0) {
        selectedValue = entity.value;
        break;
      }
    }

    setCollapsedValue({ value: selectedValue });
    return selectedValue;
  }, [superposition]);

  const getDeterministicValue = useCallback(() => {
    if (!collapsedValue) {
      throw new WaveFunctionCollapseError();
    }
    return collapsedValue.value;
  }, [collapsedValue]);

  const handleSetSuperposition = useCallback((newSuperposition: Superposition<T>) => {
    setSuperposition(newSuperposition);
    setCollapsedValue(null); // Entanglement breaks, superposition restored
  }, []);

  return {
    superposition,
    getDeterministicValue,
    isCollapsed: collapsedValue !== null,
    collapse,
    setSuperposition: handleSetSuperposition,
  };
}

export interface ObserverProps<T> {
  state: QuantumStateReturn<T>;
  children: (value: T) => ReactNode;
}

/**
 * Observer
 * The explicit component that forces the superposition to collapse into a deterministic value.
 */
export function Observer<T>({ state, children }: ObserverProps<T>) {
  useEffect(() => {
    if (!state.isCollapsed) {
      state.collapse();
    }
  }, [state]);

  if (!state.isCollapsed) {
    return null; // The non-Euclidean void prior to observation
  }

  return React.createElement(React.Fragment, null, children(state.getDeterministicValue()));
}
